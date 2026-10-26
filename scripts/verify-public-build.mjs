import assert from "node:assert/strict";
import fs from "node:fs/promises";
const { chromium } = await import(process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright");
const base = process.argv[2] || "http://localhost:5175";
const out = "artifacts/profile-themes/production";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.HIVEZ_CHROME_PATH ? { executablePath: process.env.HIVEZ_CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const result = { base, builtEntry: "", routes: [], errors: [], failedLocalRequests: [] };
page.on("pageerror", e => result.errors.push(e.message));
page.on("console", m => { if (m.type() === "error") result.errors.push(m.text()); });
page.on("response", r => { if (r.url().startsWith(base) && r.status() >= 400) result.failedLocalRequests.push(r.url()); });
try {
  for (const route of ["/", "/login", "/signup"]) {
    const response = await page.goto(base + route, { waitUntil: "networkidle" });
    assert.equal(response.status(), 200);
    const root = route === "/" ? ".hz-landing" : ".ha-page";
    if (!result.builtEntry) result.builtEntry = await page.locator('script[type="module"]').getAttribute("src");
    assert.match(result.builtEntry, /^\/assets\/index-.*\.js$/);
    for (const mode of ["light", "forest", "midnight"]) {
      for (let i = 0; i < 3 && await page.locator(root).getAttribute("data-public-theme") !== mode; i++) await page.locator("[data-public-theme-toggle]").click();
      await page.waitForTimeout(300);
      assert.equal(await page.locator(root).getAttribute("data-public-theme"), mode);
      assert.ok(await page.locator(root + ' img').evaluateAll(es => es.filter(e => e.offsetWidth > 0 && e.loading !== 'lazy').every(e => e.complete && e.naturalWidth > 0)));
    }
    await page.screenshot({ path: `${out}/${route === "/" ? "landing" : route.slice(1)}-midnight.png`, fullPage: true });
    result.routes.push({ route, modes: ["light", "forest", "midnight"], status: response.status() });
  }
  // The local fixture is not a public route or production build entry.
  await page.goto(base + "/tests/browser/profile-preview.html", { waitUntil: "networkidle" });
  assert.equal(await page.locator("#cp-form").count(), 0);
  result.fixtureExcluded = true;
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.failedLocalRequests, []);
  console.log(JSON.stringify(result));
} finally {
  await fs.writeFile(`${out}/results.json`, JSON.stringify(result, null, 2));
  await browser.close();
}
