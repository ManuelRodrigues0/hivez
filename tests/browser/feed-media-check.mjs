import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { openAppSession, origin, project, output } from "./app-session.mjs";
const endpoint = `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/posts/local-cleanup`;
const original = (await (await fetch(endpoint)).json()).fields;
const keys = ["mediaUrl", "mediaItems", "mediaUrls"];
async function patch(fields) {
  const url = new URL(endpoint);
  for (const key of keys) url.searchParams.append("updateMask.fieldPaths", key);
  const r = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({ fields }),
  });
  assert.equal(r.ok, true, await r.text());
}
const { browser, context, page, evidence } = await openAppSession({
  width: 1440,
  height: 1000,
});
const checks = [];
await fs.mkdir(`${output}/media`, { recursive: true });
try {
  await context.route(origin + "/__test__/portrait.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="400" viewBox="0 0 240 400"><rect width="240" height="400" fill="#dde4d1"/><path d="M0 320L160 140L240 220V400H0Z" fill="#365c43"/><text x="20" y="42" fill="#293326" font-family="sans-serif" font-size="15">LOCAL TEST IMAGE</text><text x="20" y="68" fill="#293326" font-family="sans-serif" font-size="13">Portrait · 240 × 400</text></svg>',
    }),
  );
  await patch({ mediaUrl: { stringValue: origin + "/__test__/portrait.svg" } });
  await page.goto(origin + "/hive/waste");
  const card = page
    .locator(".app-feed-card")
    .filter({ hasText: "A little care goes a long way." });
  const image = card.locator(".hv-post-media img");
  await image.waitFor();
  await image.evaluate((el) => el.decode());
  const box = await image.boundingBox();
  assert.ok(Math.abs(box.width / box.height - 0.6) < 0.01);
  assert.ok(box.height <= 440);
  const button = await card
    .getByRole("button", { name: "Open media full screen", exact: true })
    .boundingBox();
  assert.ok(
    Math.abs(button.width - box.width) < 1 &&
      Math.abs(button.height - box.height) < 1,
  );
  await page.screenshot({ path: `${output}/media/portrait.png` });
  checks.push(
    "Portrait keeps its 3:5 aspect ratio without a wide letterbox frame.",
  );
  await card
    .getByRole("button", { name: "Open media full screen", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Post media", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await page
    .getByRole("dialog", { name: "Post media", exact: true })
    .waitFor({ state: "hidden" });
  checks.push("Original full-resolution viewer opens and closes with Escape.");
  await patch({
    mediaUrl: original.mediaUrl,
    mediaItems: {
      arrayValue: {
        values: [
          {
            mapValue: {
              fields: {
                url: { stringValue: "/auth/people-together.jpg" },
                type: { stringValue: "image" },
              },
            },
          },
          {
            mapValue: {
              fields: {
                url: { stringValue: "/auth/local-action.jpg" },
                type: { stringValue: "image" },
              },
            },
          },
        ],
      },
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const gallery = card.locator(".hv-media-carousel");
  await gallery.waitFor();
  await gallery.scrollIntoViewIfNeeded();
  const g = await gallery.boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.wheel(280, 0);
  await page.waitForTimeout(200);
  assert.ok(await gallery.evaluate((el) => el.scrollLeft > 0));
  await gallery
    .getByRole("button", { name: "Open media full screen", exact: true })
    .nth(1)
    .click();
  const viewer = page.getByRole("dialog", { name: "Post media", exact: true });
  await viewer.waitFor();
  await page.keyboard.press("ArrowLeft");
  assert.ok(
    (await viewer.locator("img").getAttribute("src")).endsWith(
      "/auth/people-together.jpg",
    ),
  );
  await page.keyboard.press("Escape");
  await viewer.waitFor({ state: "hidden" });
  checks.push(
    "Mobile gallery scrolls horizontally with hidden tracks; the viewer preserves arrow-key media navigation.",
  );
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(
    evidence.console.filter((m) => m.type === "error"),
    [],
  );
  console.log("PASS", checks);
} catch (error) {
  checks.push({ failed: error.message });
  await page.screenshot({ path: `${output}/media/failure.png` });
  throw error;
} finally {
  await patch(
    Object.fromEntries(
      keys.filter((key) => key in original).map((key) => [key, original[key]]),
    ),
  );
  await fs.writeFile(
    `${output}/media/results.json`,
    JSON.stringify({ checks, evidence }, null, 2),
  );
  await browser.close();
}
