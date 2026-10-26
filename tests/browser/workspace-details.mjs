import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  seedDesignData,
  openAppSession,
  origin,
  project,
  output,
} from "./app-session.mjs";

const uid = await seedDesignData();
const { browser, page, evidence } = await openAppSession();
const results = [];
const dir = `${output}/details`;
await fs.mkdir(dir, { recursive: true });
async function check(name, action) {
  await action();
  results.push({ name, status: "passed" });
  console.log("PASS", name);
}
async function open(path) {
  await page.goto(origin + path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
}
async function readDocs(path) {
  const r = await fetch(
    `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/${path}`,
  );
  return (await r.json()).documents || [];
}
try {
  await check(
    "Text post: real composer, submit, resulting feed and stored document",
    async () => {
      const postText = `A little local hello. Browser verification ${Date.now()} in the isolated emulator.`;
      await open("/create");
      await page.getByRole("button", { name: /Start a conversation/ }).click();
      await page
        .getByRole("textbox", { name: "Post text", exact: true })
        .fill(postText);
      await page.screenshot({
        path: `${dir}/text-composer.png`,
        fullPage: true,
      });
      await page.getByRole("button", { name: "Share", exact: true }).click();
      await page.waitForURL(origin + "/");
      await page
        .locator(".app-feed-card")
        .filter({ hasText: postText })
        .waitFor();
      const post = (await readDocs("posts")).find(
        (p) => p.fields.caption?.stringValue === postText,
      );
      assert.ok(post);
      assert.equal(post.fields.uid.stringValue, uid);
    },
  );
  await check(
    "Profile edit saves through the real client and preserves identity",
    async () => {
      await open("/profile/edit");
      const bio = page.getByRole("textbox", { name: "Civic Bio", exact: true });
      await bio.fill(
        "Small steps. Shared spaces. Local emulator profile update.",
      );
      await page
        .getByRole("button", { name: "Save Changes", exact: true })
        .click();
      await page.waitForURL(origin + "/profile");
      await page
        .getByText(
          "Small steps. Shared spaces. Local emulator profile update.",
          { exact: true },
        )
        .waitFor();
      const r = await fetch(
        `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/users/${uid}`,
      );
      assert.equal(
        (await r.json()).fields.bio.stringValue,
        "Small steps. Shared spaces. Local emulator profile update.",
      );
    },
  );
  await check(
    "Map measures its actual pane, zooms, pans, previews and opens a post",
    async () => {
      await open("/map");
      await page.getByRole("img", { name: "You", exact: true }).waitFor();
      const centered = () =>
        page.evaluate(() => {
          const map = document.querySelector(".hv-map").getBoundingClientRect();
          const marker = document
            .querySelector('[aria-label="You"]')
            .getBoundingClientRect();
          return (
            Math.abs(marker.x + marker.width / 2 - map.x - map.width / 2) < 2 &&
            Math.abs(marker.y + marker.height / 2 - map.y - map.height / 2) < 2
          );
        });
      assert.equal(await centered(), true);
      await page
        .getByRole("button", { name: "Open community updates", exact: true })
        .filter({ visible: true })
        .click();
      await page.waitForTimeout(500);
      assert.equal(await centered(), true);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Zoom in", exact: true }).click();
      await page.getByRole("button", { name: "North", exact: true }).click();
      await page.waitForTimeout(600);
      assert.equal(await centered(), false);
      await open("/map?lat=19.076&lng=72.8777&post=local-cleanup");
      await page
        .getByRole("button", { name: "Open Post", exact: true })
        .waitFor();
      await page.screenshot({ path: `${dir}/map-preview.png` });
      await page
        .getByRole("button", { name: "Open Post", exact: true })
        .click();
      await page.waitForURL(origin + "/post/local-cleanup");
      await page.setViewportSize({ width: 390, height: 844 });
      await open("/map");
      assert.equal(await centered(), true);
      await page.screenshot({ path: `${dir}/map-mobile.png` });
    },
  );
  await check(
    "Admin mobile navigation traps focus, closes and restores focus",
    async () => {
      await open("/admin/users");
      const trigger = page.getByRole("button", {
        name: "Open admin navigation",
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog", {
        name: "Admin navigation",
        exact: true,
      });
      await dialog.waitFor();
      for (let i = 0; i < 18; i++) await page.keyboard.press("Tab");
      assert.equal(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
        true,
      );
      await page.keyboard.press("Escape");
      assert.equal(
        await trigger.evaluate((el) => el === document.activeElement),
        true,
      );
      assert.equal(
        await page
          .locator('aside[aria-label="Admin navigation"]')
          .getAttribute("inert"),
        "",
      );
    },
  );
  await check(
    "Report category and evidence step remain usable and accessible",
    async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await open("/create");
      await page.getByRole("button", { name: /Report a local issue/ }).click();
      await page
        .getByRole("heading", { name: "What are you reporting?", exact: true })
        .waitFor();
      const buttons = page.locator("main").getByRole("button");
      await buttons.filter({ hasText: "Waste" }).first().click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${dir}/report-evidence.png`,
        fullPage: true,
      });
      if (process.env.HIVEZ_AXE_PATH) {
        await page.addScriptTag({ path: process.env.HIVEZ_AXE_PATH });
        const audit = await page.evaluate(() =>
          window.axe.run(document.querySelector(".hv-app"), {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
            },
          }),
        );
        await fs.writeFile(
          `${dir}/report-accessibility.json`,
          JSON.stringify(audit.violations, null, 2),
        );
        assert.deepEqual(
          audit.violations.map((v) => ({
            id: v.id,
            targets: v.nodes.map((n) => n.target),
          })),
          [],
        );
      }
    },
  );
  await check(
    "Theme, text-size, high-contrast and reduced-motion preferences remain connected",
    async () => {
      await open("/settings/appearance");
      const themes = page.getByRole("group", {
        name: "App theme",
        exact: true,
      });
      await themes.getByRole("button").filter({ hasText: "Dark" }).click();
      await page.waitForFunction(
        () => document.querySelector(".hv-app").dataset.appTheme === "dark",
      );
      await themes.getByRole("button").filter({ hasText: "System" }).click();
      await page.emulateMedia({ colorScheme: "dark" });
      await page.waitForFunction(
        () => document.querySelector(".hv-app").dataset.appTheme === "dark",
      );
      await page.emulateMedia({ colorScheme: "light" });
      await page.waitForFunction(
        () => document.querySelector(".hv-app").dataset.appTheme === "light",
      );
      await page
        .getByRole("group", { name: "Text size", exact: true })
        .getByRole("button", { name: "Large", exact: true })
        .click();
      assert.equal(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).fontSize,
        ),
        "18px",
      );
      await open("/settings/accessibility");
      await page
        .getByRole("switch", { name: "High contrast", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() =>
          document.documentElement.classList.contains("high-contrast"),
        ),
        true,
      );
      assert.equal(
        await page
          .getByRole("switch", { name: "Reduce motion", exact: true })
          .getAttribute("aria-checked"),
        "true",
      );
      await page.setViewportSize({ width: 320, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        true,
      );
      await page.screenshot({
        path: `${dir}/large-text-high-contrast-320.png`,
        fullPage: true,
      });
      await page
        .getByRole("switch", { name: "High contrast", exact: true })
        .click();
      await page
        .getByRole("group", { name: "Text size", exact: true })
        .getByRole("button", { name: "Default", exact: true })
        .click();
      await page.setViewportSize({ width: 1024, height: 900 });
      await open("/settings");
      await page
        .getByRole("button", { name: "Open community updates", exact: true })
        .filter({ visible: true })
        .click();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: `${dir}/settings-updates-1024.png`,
        fullPage: true,
      });
    },
  );
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(
    evidence.console.filter((m) => m.type === "error"),
    [],
  );
} catch (error) {
  results.push({ status: "failed", message: error.message });
  await page.screenshot({ path: `${dir}/failure.png`, fullPage: true });
  throw error;
} finally {
  await fs.writeFile(
    `${dir}/results.json`,
    JSON.stringify({ results, evidence }, null, 2),
  );
  await browser.close();
}
