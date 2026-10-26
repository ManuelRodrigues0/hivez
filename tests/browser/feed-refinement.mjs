import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { openAppSession, origin, output } from "./app-session.mjs";

const results = [];
const routes = [
  "/",
  "/profile",
  "/profile/edit",
  "/search",
  "/notifications",
  "/saved",
  "/volunteering",
  "/my-volunteering",
  "/settings",
  "/chats",
  "/map",
  "/hive/waste",
];
const audited = ["/", "/profile", "/saved", "/search"];
await fs.mkdir(`${output}/review`, { recursive: true });
for (const theme of ["dark", "light"]) {
  const { browser, page, evidence } = await openAppSession({ theme });
  try {
    for (const width of [1920, 1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(origin + route, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(300);
        await page.locator(".hv-content").waitFor({ state: "visible" });
        await page
          .locator(".hv-content > .hivez-loader-screen")
          .waitFor({ state: "hidden", timeout: 15000 });
        const item = await page.evaluate(() => {
          const shell = document.querySelector(".hv-content");
          const root = shell?.firstElementChild;
          const a = shell?.getBoundingClientRect(),
            b = root?.getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            gutters:
              a && b
                ? {
                    left: Math.round(b.left - a.left),
                    right: Math.round(a.right - b.right),
                  }
                : null,
            rootScrollbar: getComputedStyle(document.documentElement)
              .scrollbarWidth,
          };
        });
        Object.assign(item, { theme, width, route });
        assert.equal(item.overflow, false, JSON.stringify(item));
        assert.equal(item.rootScrollbar, "none");
        if (item.gutters) {
          assert.ok(
            Math.abs(item.gutters.left) <= 1 &&
              Math.abs(item.gutters.right) <= 1,
            JSON.stringify(item),
          );
        }
        if (
          audited.includes(route) &&
          [1440, 390].includes(width) &&
          process.env.HIVEZ_AXE_PATH
        ) {
          await page.addScriptTag({ path: process.env.HIVEZ_AXE_PATH });
          const audit = await page.evaluate(() =>
            window.axe.run(document.querySelector(".hv-app"), {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
              },
            }),
          );
          item.violations = audit.violations.map((v) => ({
            id: v.id,
            targets: v.nodes.map((n) => n.target),
          }));
          assert.deepEqual(item.violations, [], JSON.stringify(item));
        }
        if (route === "/") {
          assert.equal(
            await page.locator(".hv-home > .hv-page-intro").count(),
            0,
          );
          await page
            .getByRole("heading", { name: "Your feed", exact: true })
            .waitFor();
          const card = page.locator(".app-feed-card").first();
          await card.waitFor();
          item.post = await card.evaluate((el) => {
            const s = getComputedStyle(el);
            return {
              radius: s.borderRadius,
              background: s.backgroundColor,
              shadow: s.boxShadow,
              borderLeft: s.borderLeftWidth,
              borderRight: s.borderRightWidth,
            };
          });
          assert.equal(item.post.radius, "0px");
          assert.equal(item.post.background, "rgba(0, 0, 0, 0)");
          assert.equal(item.post.borderLeft, "0px");
          assert.equal(item.post.borderRight, "0px");
          if (width >= 1024) {
            const boxes = await page.evaluate(() => {
              const b = document.querySelector(".hv-brand-bee"),
                s = document.querySelector(".hv-global-search");
              return {
                bee: b.getBoundingClientRect().toJSON(),
                search: s.getBoundingClientRect().toJSON(),
                source: b.currentSrc,
              };
            });
            assert.ok(boxes.bee.width >= (width > 1270 ? 100 : 88));
            assert.ok(boxes.bee.right < boxes.search.left);
            assert.ok(boxes.source.endsWith("/assets/hivez-ultra-bee.webm"));
            item.bee = boxes.bee;
          }
          if ([1920, 1440, 390].includes(width))
            await page.screenshot({
              path: `${output}/review/feed-${theme}-${width}.png`,
            });
        }
        if (route === "/profile" && [1920, 1440, 390].includes(width))
          await page.screenshot({
            path: `${output}/review/profile-${theme}-${width}.png`,
          });
        results.push(item);
      }
    }
    if (theme === "dark") {
      await page.setViewportSize({ width: 1440, height: 600 });
      await page.goto(origin + "/");
      await page.locator(".app-feed-card").first().waitFor();
      const nav = page.locator(".hv-sidebar .hv-navigation");
      const box = await nav.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + 100);
      await page.mouse.wheel(0, 700);
      await page.waitForTimeout(200);
      assert.ok(await nav.evaluate((el) => el.scrollTop > 0));
      assert.equal(
        await nav.evaluate((el) => getComputedStyle(el).scrollbarWidth),
        "none",
      );
      await page.locator("#hv-content").focus();
      await page.keyboard.press("PageDown");
      await page.waitForTimeout(200);
      assert.ok(await page.evaluate(() => scrollY > 0));
      results.push({
        check:
          "Hidden tracks retain sidebar wheel scrolling and page keyboard scrolling",
        passed: true,
      });
      await page.setViewportSize({ width: 1024, height: 900 });
      await page.goto(origin + "/profile");
      await page
        .getByRole("button", { name: "Open community updates", exact: true })
        .filter({ visible: true })
        .click();
      await page.waitForTimeout(350);
      const pane = await page.evaluate(() => {
        const p = document.querySelector(".hv-profile").getBoundingClientRect(),
          u = document.querySelector(".app-updates").getBoundingClientRect();
        return {
          overlap: p.right > u.left + 1,
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      assert.deepEqual(pane, { overlap: false, overflow: false });
      results.push({
        check: "Full-width profile respects the open Updates panel",
        passed: true,
      });
    }
    assert.deepEqual(evidence.errors, []);
    assert.deepEqual(
      evidence.console.filter((m) => m.type === "error"),
      [],
    );
  } finally {
    await fs.writeFile(
      `${output}/review/${theme}-results.json`,
      JSON.stringify(
        {
          results: results.filter((x) => x.theme === theme || x.check),
          evidence,
        },
        null,
        2,
      ),
    );
    await browser.close();
  }
}
await fs.writeFile(
  `${output}/review/results.json`,
  JSON.stringify(results, null, 2),
);
console.log("PASS", results.length, "layout/interaction states");
