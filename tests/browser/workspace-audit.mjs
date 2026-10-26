import fs from "node:fs/promises";
import { openAppSession, origin, output } from "./app-session.mjs";
const dir = `${output}/audit`;
await fs.mkdir(dir, { recursive: true });
const core = [
  "/",
  "/search",
  "/hive/waste",
  "/profile",
  "/profile/edit",
  "/notifications",
  "/activity",
  "/saved",
  "/volunteering",
  "/my-volunteering",
  "/volunteer-group/local-group",
  "/issue-community/issue_local-cleanup",
  "/issue-community/issue_local-cleanup/details",
  "/chats",
  "/map",
  "/post/local-cleanup",
  "/create",
];
const settings = [
  "",
  "account",
  "privacy",
  "security",
  "notifications",
  "content",
  "appearance",
  "accessibility",
  "language",
  "data",
  "delete",
].map((x) => "/settings" + (x ? "/" + x : ""));
const admin = [
  "",
  "users",
  "posts",
  "reports",
  "issues",
  "hives",
  "ai-queue",
  "notifications",
  "analytics",
  "media",
  "roles",
  "settings",
  "logs",
].map((x) => "/admin" + (x ? "/" + x : ""));
const primary = [
  "/",
  "/search",
  "/profile",
  "/notifications",
  "/saved",
  "/volunteering",
  "/volunteer-group/local-group",
  "/issue-community/issue_local-cleanup",
  "/chats",
  "/map",
  "/create",
  "/settings",
  "/admin",
  "/admin/users",
];
const results = [];
const runtime = [];
for (const theme of ["light", "dark"]) {
  const { browser, page, evidence } = await openAppSession({ theme });
  try {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const route of theme === "light"
        ? [...core, ...settings, ...admin, "/missing-local-page"]
        : primary) {
        const response = await page.goto(origin + route, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForTimeout(500);
        const status = response?.status();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        const headings = await page.locator("h1").allTextContents();
        const item = {
          theme,
          width,
          route,
          finalRoute: new URL(page.url()).pathname,
          status,
          overflow,
          headings,
          violations: [],
        };
        if (primary.includes(route) && process.env.HIVEZ_AXE_PATH) {
          await page.addScriptTag({ path: process.env.HIVEZ_AXE_PATH });
          const audit = await page.evaluate(() =>
            window.axe.run(document.querySelector(".hv-app") || document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
              },
            }),
          );
          item.violations = audit.violations.map((v) => ({
            id: v.id,
            help: v.help,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          }));
          await page.screenshot({
            path: `${dir}/${route === "/" ? "feed" : route.slice(1).replaceAll("/", "-")}-${theme}-${width}.png`,
            fullPage: true,
          });
        }
        results.push(item);
        console.log(
          theme,
          width,
          route,
          "overflow",
          overflow,
          "axe",
          item.violations.length,
        );
      }
    }
    if (theme === "light") {
      for (const width of [320, 768, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of [
          "/",
          "/profile",
          "/volunteering",
          "/settings",
          "/chats",
          "/admin/users",
        ]) {
          await page.goto(origin + route);
          await page.waitForTimeout(400);
          results.push({
            theme,
            width,
            route,
            overflow: await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            headings: await page.locator("h1").allTextContents(),
          });
        }
      }
      await page.setViewportSize({ width: 1024, height: 900 });
      await page.goto(origin + "/settings");
      await page.waitForTimeout(350);
      await page
        .getByRole("button", { name: "Open community updates", exact: true })
        .filter({ visible: true })
        .click();
      await page.waitForTimeout(350);
      const overlap = await page.evaluate(() => {
        const body = document
          .querySelector(".settings-content")
          ?.getBoundingClientRect();
        const rail = document
          .querySelector(".app-updates")
          ?.getBoundingClientRect();
        return body && rail ? body.right > rail.left + 1 : false;
      });
      results.push({
        theme,
        width: 1024,
        route: "/settings",
        updatesOpen: true,
        overlap,
        overflow: await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
      });
      await page.screenshot({
        path: `${dir}/settings-updates-1024.png`,
        fullPage: true,
      });
    }
  } finally {
    runtime.push({ theme, ...evidence });
    await browser.close();
  }
}
await fs.writeFile(
  `${dir}/results.json`,
  JSON.stringify({ results, runtime }, null, 2),
);
const failures = results.filter(
  (x) => x.overflow || x.overlap || x.violations?.length || x.status >= 400,
);
await fs.writeFile(`${dir}/issues.json`, JSON.stringify(failures, null, 2));
console.log(
  "AUDITED",
  results.length,
  "states; actionable states",
  failures.length,
  "exceptions",
  runtime.flatMap((x) => x.errors),
);
