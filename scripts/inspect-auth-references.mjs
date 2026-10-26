const { chromium } = await import(
  process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright"
);
import fs from "node:fs/promises";
const out = process.env.HIVEZ_RESEARCH_OUTPUT || "artifacts/auth/research";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.HIVEZ_CHROME_PATH
    ? { executablePath: process.env.HIVEZ_CHROME_PATH }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const urls = process.argv.slice(2);
const results = [];
for (const [i, url] of urls.entries()) {
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${out}/${i}-open.png` });
    const text = (await page.locator("body").innerText()).slice(0, 14000);
    const links = await page
      .locator("a[href]")
      .evaluateAll((els) =>
        els
          .map((e) => ({ text: e.innerText.trim().slice(0, 100), url: e.href }))
          .filter((e) => e.text),
      );
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${out}/${i}-scroll.png` });
    results.push({ url, status: response?.status(), text, links });
    console.log(
      JSON.stringify({
        url,
        status: response?.status(),
        text: text.slice(0, 4000),
        links: links
          .filter(
            (x) => x.url.includes("/sites/") || !x.url.includes("awwwards.com"),
          )
          .slice(0, 28),
      }),
    );
  } catch (e) {
    results.push({ url, error: e.message });
    console.log(url, e.message);
  }
}
await fs.writeFile(`${out}/inspection.json`, JSON.stringify(results, null, 2));
await browser.close();
