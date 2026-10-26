import fs from "node:fs/promises";
const { chromium } = await import(
  process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright"
);
const output = "artifacts/feed-refinement/research";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.HIVEZ_CHROME_PATH,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const results = [];
try {
  for (const [name, url] of [
    ["bluesky", "https://bsky.app/profile/bsky.app"],
    ["mastodon", "https://mastodon.social/explore"],
    ["arena", "https://www.are.na/"],
    ["awwwards", "https://www.awwwards.com/websites/app-style/"],
  ]) {
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${output}/${name}-desktop.png` });
      const text = (await page.locator("body").innerText()).slice(0, 6500);
      await page.mouse.wheel(0, 650);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${output}/${name}-scrolled.png` });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${output}/${name}-mobile.png` });
      results.push({
        name,
        url,
        finalUrl: page.url(),
        status: response?.status(),
        text,
      });
    } catch (error) {
      results.push({ name, url, error: error.message });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
} finally {
  await fs.writeFile(
    `${output}/results.json`,
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
console.log(
  results.map(({ name, status, error }) => ({ name, status, error })),
);
