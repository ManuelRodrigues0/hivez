import fs from "node:fs/promises";
const { chromium } = await import(process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright");
const out = "artifacts/profile-themes/research/interactions";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.HIVEZ_CHROME_PATH ? { executablePath: process.env.HIVEZ_CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(7000);
const results = [];
for (const [name, url] of [["cash-color", "https://design.cash.app/color"], ["lenzing-contact", "https://www.studiolenzing.com/contact"]]) {
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${out}/${name}-open.png` });
    const inputs = await page.locator("input,textarea,button").evaluateAll(es => es.map(e => ({ tag: e.tagName, type: e.type, text: e.innerText, placeholder: e.placeholder })).slice(0, 30));
    const text = (await page.locator("body").innerText()).slice(0, 15000);
    if (name === "cash-color") {
      await page.mouse.wheel(0, 750);
      await page.waitForTimeout(1000);
    } else {
      const field = page.locator("input:visible,textarea:visible").first();
      if (await field.count()) await field.focus();
      else await page.mouse.wheel(0, 650);
    }
    await page.screenshot({ path: `${out}/${name}-interaction.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${out}/${name}-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
    results.push({ name, url: page.url(), status: response?.status(), text, inputs });
    console.log(name, response?.status(), text.slice(0, 400));
  } catch (error) { results.push({ name, url, error: error.message }); console.log(name, error.message); }
}
await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
