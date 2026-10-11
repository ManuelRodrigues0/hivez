import { seedAccount, openSession, go, output } from "./settings-session.mjs";
import fs from "node:fs/promises";
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
const sizes = [
  [320, 844],
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
];
const uid = await seedAccount();
const session = await openSession({ viewport: { width: 1440, height: 900 } });
const { page, browser, evidence, context } = session;
await page.screenshot({ path: `${output}/overview-dark.png`, fullPage: true });
const results = [];
for (const [width, height] of sizes) {
  await page.setViewportSize({ width, height });
  for (const route of routes) {
    if (route === "saved" || route === "activity") {
      if (!page.url().startsWith("http://localhost:5173/settings"))
        await page.goto("http://localhost:5173/settings");
      await go(page, route);
    } else await go(page, route);
    await page.waitForTimeout(70);
    const item = await page.evaluate(() => {
      const box = document
        .querySelector(".hivez-settings")
        ?.getBoundingClientRect();
      const content = document
        .querySelector(".settings-content")
        ?.getBoundingClientRect();
      const selectors = [
        ...document.querySelectorAll(
          ".hivez-settings input,.hivez-settings select,.hivez-settings button,.hivez-settings a",
        ),
      ];
      const clipped = selectors
        .map((el) => ({
          name: (el.getAttribute("aria-label") || el.textContent || el.tagName)
            .trim()
            .slice(0, 70),
          rect: (() => {
            const r = el.getBoundingClientRect();
            return {
              left: Math.round(r.left),
              right: Math.round(r.right),
              width: Math.round(r.width),
            };
          })(),
        }))
        .filter(
          (x) =>
            x.rect.width > 0 &&
            (x.rect.left < 0 || x.rect.right > innerWidth + 1),
        );
      return {
        scrollWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        window: innerWidth,
        hivezWidth: Math.round(box?.width || 0),
        contentWidth: Math.round(content?.width || 0),
        clipped: clipped.slice(0, 6),
        heading: document.querySelector(".settings-page-heading h1")?.innerText,
        theme: document.documentElement.className,
      };
    });
    const redirectOk =
      route === "saved"
        ? page.url().endsWith("/saved")
        : route === "activity"
          ? page.url().endsWith("/activity")
          : true;
    results.push({ width, height, route, ...item, redirectOk });
    if (
      width === 1440 &&
      height === 900 &&
      [
        "",
        "account",
        "privacy",
        "notifications",
        "content",
        "appearance",
        "accessibility",
        "language",
        "data",
        "delete",
      ].includes(route)
    )
      await page.screenshot({
        path: `${output}/desktop-dark-${route || "overview"}.png`,
        fullPage: true,
      });
  }
}
// Theme selection is app-owned local state; emulator account remains isolated.
await page.setViewportSize({ width: 1440, height: 900 });
await go(page, "appearance");
await page.getByRole("button", { name: /Light A fresh start/ }).click();
await page.waitForTimeout(600);
const lightClass = await page.locator("html").getAttribute("class");
await page.screenshot({
  path: `${output}/appearance-light.png`,
  fullPage: true,
});
await page.getByRole("button", { name: /Dark A softer glow/ }).click();
await page.waitForTimeout(600);
await page.screenshot({
  path: `${output}/appearance-dark.png`,
  fullPage: true,
});
// Browse major sections in light mode too.
await page.goto("http://localhost:5173/settings");
for (const route of [
  "",
  "account",
  "privacy",
  "security",
  "notifications",
  "content",
  "accessibility",
  "language",
  "data",
  "delete",
]) {
  await go(page, route);
  await page.screenshot({
    path: `${output}/desktop-light-${route || "overview"}.png`,
    fullPage: true,
  });
}
// Real interaction smoke checks against emulators / isolated localStorage.
const interaction = {};
await go(page, "");
const search = page.getByRole("searchbox", { name: "Find a setting" });
await search.fill("discoverability");
interaction.searchResults = await page
  .locator(".settings-search-result")
  .count();
await page.keyboard.press("Escape");
interaction.searchEscape = (await search.inputValue()) === "";
await page.keyboard.press("Control+k");
interaction.searchShortcut = await search.evaluate(
  (el) => document.activeElement === el,
);
await search.press("Escape");
await go(page, "appearance");
await page.getByRole("button", { name: /System Follow your device/ }).click();
interaction.systemTheme = await page.evaluate(() =>
  localStorage.getItem("hivez-theme"),
);
await page.getByRole("button", { name: /Dark A softer glow/ }).click();
interaction.darkTheme = await page.evaluate(() =>
  localStorage.getItem("hivez-theme"),
);
await go(page, "accessibility");
await page.getByRole("switch", { name: "High contrast" }).click();
interaction.highContrast = await page.evaluate(() =>
  localStorage.getItem("hivez-high-contrast"),
);
await page.getByRole("switch", { name: "High contrast" }).click();
await page.getByRole("switch", { name: "Reduce motion" }).click();
interaction.reducedMotion = await page.evaluate(() =>
  localStorage.getItem("hivez-reduced-motion"),
);
await page.keyboard.press("Tab");
interaction.focusVisible = await page.evaluate(
  () => !!document.querySelector(":focus-visible"),
);
await go(page, "data");
await page.getByRole("button", { name: "Clear cache" }).click();
interaction.dialogOpened = await page.getByRole("dialog").isVisible();
await page.keyboard.press("Escape");
interaction.escapeClosesDialog = (await page.getByRole("dialog").count()) === 0;
await page.getByRole("button", { name: "Clear cache" }).click();
await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
interaction.cancelClosesDialog = (await page.getByRole("dialog").count()) === 0;
await go(page, "delete");
await page.getByRole("button", { name: "Sign out", exact: true }).click();
await page.keyboard.press("Escape");
interaction.escapeClosesSignout =
  (await page.getByRole("dialog").count()) === 0;
for (const route of ["saved", "activity"]) {
  await go(page, route);
  interaction[`${route}Redirect`] = page.url().endsWith(`/${route}`);
}
await page.goto("http://localhost:5173/settings");
await page.getByRole("link", { name: /Edit profile/ }).click();
interaction.profileShortcut = page.url().endsWith("/profile/edit");
await context.close();
await browser.close();
const summary = {
  uid,
  browser: evidence.browser,
  sizes,
  routeCount: routes.length,
  results,
  interaction,
  console: evidence.console,
  exceptions: evidence.exceptions,
  blocked: evidence.blocked,
  failedRequests: evidence.failedRequests,
  lightClass,
};
await fs.writeFile(
  `${output}/audit-metrics.json`,
  JSON.stringify(summary, null, 2),
);
console.log(
  JSON.stringify(
    {
      browser: summary.browser,
      viewportCount: sizes.length,
      routeCount: routes.length,
      overflow: results.filter(
        (x) =>
          x.scrollWidth > x.window ||
          x.bodyWidth > x.window ||
          x.clipped.length,
      ),
      redirectFailures: results.filter((x) => !x.redirectOk),
      interaction,
      console: evidence.console,
      exceptions: evidence.exceptions,
      failedRequests: evidence.failedRequests,
      blocked: evidence.blocked,
    },
    null,
    2,
  ),
);
