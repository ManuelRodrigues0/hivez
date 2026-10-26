const { chromium } = await import(
  process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright"
);
import fs from "node:fs/promises";
const browser = await chromium.launch({
  ...(process.env.HIVEZ_CHROME_PATH
    ? { executablePath: process.env.HIVEZ_CHROME_PATH }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(6000);
const results = [];
async function record(name, action) {
  try {
    await action();
    await page.screenshot({ path: `artifacts/auth/research/${name}.png` });
    results.push({
      name,
      url: page.url(),
      text: (await page.locator("body").innerText()).slice(0, 9000),
    });
    console.log(name, "done");
  } catch (e) {
    results.push({ name, error: e.message });
    console.log(name, e.message);
  }
}
await record("signal-contact", async () => {
  await page.goto("https://signal-a.studio/");
  await page.locator('a[href="/contact"]:visible').first().click();
  await page.waitForTimeout(2200);
  console.log(
    "contact inputs",
    await page
      .locator("input,textarea")
      .evaluateAll((es) =>
        es.map((e) => ({
          tag: e.tagName,
          type: e.type,
          placeholder: e.placeholder,
        })),
      ),
  );
});
await record("brandon-menu", async () => {
  await page.goto("https://brandonyasin.com/");
  await page.waitForTimeout(2000);
  await page
    .getByText(/^menu$/i)
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForTimeout(1400);
});
await record("goshuin-next", async () => {
  await page.goto("https://aestudio.studio/goshuin/en");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Next/ }).click();
  await page.waitForTimeout(1000);
});
await record("goshuin-mobile", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
});
await record("awwwards-field-focus", async () => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("https://www.awwwards.com/login/");
  console.log(
    "form fields",
    await page
      .locator("input")
      .evaluateAll((es) =>
        es.map((e) => ({ type: e.type, label: e.getAttribute("id") })),
      ),
  );
  await page.locator("input:visible").first().focus();
  await page.waitForTimeout(500);
});
await fs.writeFile(
  "artifacts/auth/research/interactions-second.json",
  JSON.stringify(results, null, 2),
);
await browser.close();
