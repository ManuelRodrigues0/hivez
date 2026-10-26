import fs from "node:fs/promises";
const { chromium } = await import(
  process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright"
);
const out = "artifacts/app-redesign/research/interactions";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.HIVEZ_CHROME_PATH,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(8000);
const results = [];
async function inspect(name, url, interact) {
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 25000,
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${out}/${name}-open.png` });
    if (interact) await interact();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${out}/${name}-interaction.png` });
    const text = (await page.locator("body").innerText()).slice(0, 18000);
    const links = await page
      .locator('a[href*="/sites/"]')
      .evaluateAll((es) =>
        es.map((e) => ({
          url: e.href,
          label:
            e.innerText ||
            e.querySelector("img")?.alt ||
            e.getAttribute("aria-label"),
        })),
      );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${out}/${name}-mobile.png` });
    await page.setViewportSize({ width: 1440, height: 1000 });
    results.push({
      name,
      url: page.url(),
      status: response?.status(),
      text,
      links,
    });
    console.log(name, response?.status(), page.url());
  } catch (e) {
    results.push({ name, url, error: e.message });
    console.log(name, e.message.slice(0, 180));
  }
}
await inspect(
  "social-category",
  "https://www.awwwards.com/websites/social-responsibility/",
  async () => {
    await page.mouse.wheel(0, 1200);
  },
);
await inspect("cosmos-explore", "https://www.cosmos.so/", async () => {
  const link = page.getByRole("link", { name: "Explore Cosmos", exact: true });
  if (await link.count()) await link.first().click();
  await page.mouse.wheel(0, 650);
});
await inspect("format", "https://format.obys.agency/", async () => {
  await page.mouse.wheel(0, 1000);
});
await inspect(
  "cash-graphic-ui",
  "https://design.cash.app/graphic-ui",
  async () => {
    const okay = page.getByRole("button", { name: "Okay", exact: true });
    if (await okay.count()) await okay.click();
    await page.waitForTimeout(3000);
    await page.mouse.wheel(0, 700);
  },
);
await fs.writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
