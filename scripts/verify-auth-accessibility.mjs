import assert from "node:assert/strict";
import fs from "node:fs/promises";
const { chromium } = await import(
  process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  ...(process.env.HIVEZ_CHROME_PATH
    ? { executablePath: process.env.HIVEZ_CHROME_PATH }
    : {}),
});
const context = await browser.newContext();
await context.addInitScript(() => {
  localStorage.setItem("hivez-theme", "light");
  localStorage.setItem("hivez-reduced-motion", "true");
});
const page = await context.newPage();
const base = process.argv[2] || "http://localhost:5173";
const out = process.argv[3] || "artifacts/auth/final";
const results = [];
await fs.mkdir(out, { recursive: true });
try {
  for (const view of ["login", "signup", "signup-passwords"]) {
    const route = view === "login" ? "/login" : "/signup";
    await page.goto(base + route, { waitUntil: "networkidle" });
    if (view === "signup-passwords") {
      await page.getByLabel("Full name").fill("Browser Check");
      await page
        .getByLabel("Email address")
        .fill("hivez-ui-check@example.invalid");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    }
    for (const theme of ["light", "forest", "midnight"]) {
      for (let i = 0; i < 3 && await page.locator(".ha-page").getAttribute("data-public-theme") !== theme; i++) {
        await page.locator("[data-public-theme-toggle]").click();
      }
      await page.waitForTimeout(300);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.addScriptTag({ path: process.env.HIVEZ_AXE_PATH });
        const result = await page.evaluate(() =>
          window.axe.run(document.querySelector(".ha-page"), {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
            },
          }),
        );
        results.push({
          route,
          view,
          theme,
          width,
          violations: result.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            help: v.help,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
          passes: result.passes.length,
        });
        console.log(
          route,
          theme,
          width,
          "violations",
          result.violations.length,
        );
      }
    }
  }
  assert.ok(results.every((r) => r.violations.length === 0));
} finally {
  await fs.writeFile(
    `${out}/accessibility-results.json`,
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
