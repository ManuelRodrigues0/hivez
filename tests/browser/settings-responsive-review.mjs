import { openSession, go, output, seedAccount } from "./settings-session.mjs";
import fs from "node:fs/promises";

const uid = await seedAccount();
const { page, browser, context, evidence } = await openSession();
const screenshots = [];
for (const [width, height] of [
  [320, 844],
  [390, 844],
  [768, 1024],
  [1024, 768],
]) {
  await page.setViewportSize({ width, height });
  for (const route of ["", "account", "privacy", "appearance"]) {
    await go(page, route);
    const path = `${output}/review-${width}-${route || "overview"}.png`;
    await page.screenshot({ path, fullPage: true });
    screenshots.push(path);
  }
}

// Switch with the real Appearance controls and exercise every Settings route
// at all requested viewport sizes in light mode as well.
await page.setViewportSize({ width: 1440, height: 900 });
await go(page, "appearance");
await page.getByRole("button", { name: /Light A fresh start/ }).click();
const routes = [
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
  "saved",
  "activity",
];
const lightMatrix = [];
for (const [width, height] of [
  [320, 844],
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
]) {
  await page.setViewportSize({ width, height });
  for (const route of routes) {
    await go(page, route);
    const item = await page.evaluate(() => ({
      viewport: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      theme: document.documentElement.className,
      controlsOutOfBounds: [...document.querySelectorAll(
        ".hivez-settings input,.hivez-settings select,.hivez-settings button,.hivez-settings a",
      )].some((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.left < 0 || r.right > innerWidth + 1);
      }),
    }));
    lightMatrix.push({ width, height, route, ...item });
  }
}
await page.setViewportSize({ width: 1440, height: 900 });
await go(page, "privacy");
const heading = await page.locator(".settings-page-heading h1").innerText();
const headerMatrix = [];
for (const route of [
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
]) {
  await go(page, route);
  headerMatrix.push({
    route,
    title: await page.locator(".app-desktop-header h1.text-center").innerText(),
    heading: await page.locator(".settings-page-heading h1").innerText(),
  });
}
await go(page, "privacy");

const endpoint = `http://127.0.0.1:8080/v1/projects/demo-hivez-settings/databases/(default)/documents/users/${uid}`;
async function discoverable() {
  const response = await fetch(endpoint, {
    headers: { Authorization: "Bearer owner" },
  });
  if (!response.ok) throw new Error(await response.text());
  const json = await response.json();
  return json.fields?.privacy?.mapValue?.fields?.discoverable?.booleanValue;
}
async function waitForValue(value) {
  for (let i = 0; i < 40; i++) {
    if ((await discoverable()) === value) return true;
    await page.waitForTimeout(100);
  }
  return false;
}
async function waitForSwitchEnabled(locator) {
  for (let i = 0; i < 40; i++) {
    if (await locator.isEnabled()) return true;
    await page.waitForTimeout(50);
  }
  return false;
}

const initial = await discoverable();
const discoverability = page.getByRole("switch", { name: "Discoverability" });
await discoverability.focus();
await page.keyboard.press("Space");
const savedFalse = await waitForValue(false);
const switchReenabled = await waitForSwitchEnabled(discoverability);
const keyboardFocusRestored =
  (await discoverability.evaluate((el) => document.activeElement === el)) &&
  switchReenabled;
await page.keyboard.press("Space");
await waitForSwitchEnabled(discoverability);
const restoredTrue = await waitForValue(true);

await fs.writeFile(
  `${output}/responsive-review.json`,
  JSON.stringify(
    {
      screenshots,
      lightMatrix,
      headerMatrix,
      heading,
      headerFailures: headerMatrix.filter((entry) => entry.title !== entry.heading),
      initial,
      savedFalse,
      switchReenabled,
      keyboardFocusRestored,
      restoredTrue,
      final: await discoverable(),
      console: evidence.console,
      exceptions: evidence.exceptions,
      failedRequests: evidence.failedRequests,
      blocked: evidence.blocked,
    },
    null,
    2,
  ),
);
await context.close();
await browser.close();
console.log(
  JSON.stringify(
    {
      screenshotCount: screenshots.length,
      lightRouteViewportCount: lightMatrix.length,
      lightOverflow: lightMatrix.filter(
        (x) => x.documentWidth > x.viewport || x.bodyWidth > x.viewport || x.controlsOutOfBounds,
      ),
      heading,
      initial,
      savedFalse,
      switchReenabled,
      keyboardFocusRestored,
      restoredTrue,
      final: await discoverable(),
      console: evidence.console,
      exceptions: evidence.exceptions,
      failedRequests: evidence.failedRequests,
      blocked: evidence.blocked,
    },
    null,
    2,
  ),
);
