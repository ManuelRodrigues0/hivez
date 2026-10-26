import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { openAppSession, origin, output } from "./app-session.mjs";
const { browser, page, evidence } = await openAppSession({
  camera: true,
  width: 390,
  height: 844,
});
const result = {
  device: "Chromium synthetic camera/microphone; no physical device accessed",
  checks: [],
};
try {
  await page.goto(origin + "/camera");
  await page.waitForFunction(() => {
    const v = document.querySelector("video");
    return v && v.readyState >= 2 && v.videoWidth > 0;
  });
  await page.evaluate(() => {
    window.__cameraStreams = [document.querySelector("video").srcObject];
  });
  await page.waitForTimeout(250);
  result.checks.push(
    "Actual Camera component received a live synthetic MediaStream.",
  );
  await page
    .getByRole("button", { name: "Camera options", exact: true })
    .click();
  await page.getByRole("button", { name: "Grid", exact: true }).click();
  await page
    .getByRole("button", { name: "Take photo (hold to record)", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Use captured media", exact: true })
    .waitFor();
  await page.screenshot({ path: `${output}/flows/camera-capture.png` });
  await page
    .getByRole("button", { name: "Use captured media", exact: true })
    .click();
  await page.waitForURL(origin + "/create");
  await page.locator(".app-create-page img").first().waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector(".app-create-page img");
    return image && image.complete && image.naturalWidth > 0;
  });
  const states = await page.evaluate(() =>
    window.__cameraStreams.flatMap((s) =>
      s.getTracks().map((t) => t.readyState),
    ),
  );
  assert.ok(states.length > 0 && states.every((state) => state === "ended"));
  result.checks.push(
    "Keyboard shutter created a photo; media rendered in the real composer; camera and microphone tracks ended after leaving the viewfinder.",
  );
  await page.screenshot({
    path: `${output}/flows/camera-composer.png`,
    fullPage: true,
  });
  assert.deepEqual(evidence.errors, []);
} finally {
  await fs.writeFile(
    `${output}/flows/camera-results.json`,
    JSON.stringify({ result, evidence }, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify(result));
