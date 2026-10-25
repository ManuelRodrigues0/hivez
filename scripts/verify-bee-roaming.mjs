import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const { chromium } = await import(
  process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.argv[2] || "http://localhost:5173";
const output = path.resolve(process.argv[3] || "artifacts/bee-roaming");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.HIVEZ_CHROME_PATH
    ? { executablePath: process.env.HIVEZ_CHROME_PATH }
    : {}),
});
const report = {
  base,
  checkedAt: new Date().toISOString(),
  checks: [],
  errors: [],
  networkFailures: [],
};
const check = (name, evidence) => {
  report.checks.push({ name, evidence });
  console.log(`PASS ${name}`);
};
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  ...(process.env.HIVEZ_RECORD_VIDEO === "1"
    ? {
        recordVideo: {
          dir: path.join(output, "video"),
          size: { width: 960, height: 640 },
        },
      }
    : {}),
});
await context.addInitScript(() => {
  localStorage.setItem("hivez-theme", "light");
  localStorage.setItem("hivez-reduced-motion", "false");
  const listeners = new Set();
  const add = window.addEventListener.bind(window),
    remove = window.removeEventListener.bind(window);
  window.addEventListener = (type, fn, opts) => {
    if (type === "mousemove" || type === "pointermove") listeners.add(fn);
    add(type, fn, opts);
  };
  window.removeEventListener = (type, fn, opts) => {
    if (type === "mousemove" || type === "pointermove") listeners.delete(fn);
    remove(type, fn, opts);
  };
  Object.defineProperty(window, "__beeInputListeners", {
    get: () =>
      [...listeners].filter(
        (fn) => !String(fn).includes("_hitTargetInterceptor"),
      ).length,
  });
  window.__beeTrace = { samples: [], outside: [], maxStep: 0, last: null };
  let lastSample = 0;
  function sample(time) {
    const e = document.querySelector(".hz-bee-flight");
    if (e && e.parentElement.dataset.ready) {
      const r = e.getBoundingClientRect(),
        v = visualViewport;
      const viewport = {
        left: v.offsetLeft,
        top: v.offsetTop,
        width: v.width,
        height: v.height,
      };
      const point = {
        time,
        x: r.x + r.width / 2,
        y: r.y + r.height / 2,
        width: r.width,
        height: r.height,
        // The source artwork faces left; a negative matrix a flips it to face right.
        orientationX: Math.sign(
          new DOMMatrixReadOnly(getComputedStyle(e).transform).a,
        ),
        viewport,
        fieldX: Number(document.querySelector(".hz-honeycomb").dataset.beeX),
        fieldY: Number(document.querySelector(".hz-honeycomb").dataset.beeY),
      };
      if (
        r.left < viewport.left - 0.5 ||
        r.top < viewport.top - 0.5 ||
        r.right > viewport.left + viewport.width + 0.5 ||
        r.bottom > viewport.top + viewport.height + 0.5
      )
        window.__beeTrace.outside.push(point);
      const prev = window.__beeTrace.last;
      if (
        prev &&
        prev.viewport.width === viewport.width &&
        prev.viewport.height === viewport.height &&
        time - prev.time < 100
      )
        window.__beeTrace.maxStep = Math.max(
          window.__beeTrace.maxStep,
          Math.hypot(prev.x - point.x, prev.y - point.y),
        );
      window.__beeTrace.last = point;
      if (time - lastSample > 200) {
        window.__beeTrace.samples.push(point);
        lastSample = time;
      }
    }
    requestAnimationFrame(sample);
  }
  requestAnimationFrame(sample);
});
const page = await context.newPage();
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") report.errors.push(m.text());
});
page.on("response", (r) => {
  if (r.status() >= 400)
    report.networkFailures.push({
      path: new URL(r.url()).pathname,
      status: r.status(),
    });
});
const position = (target) => target.locator(".hz-bee-flight").boundingBox();
const center = (p) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
try {
  assert.equal(
    (await page.goto(base, { waitUntil: "networkidle" })).status(),
    200,
  );
  await page.locator("[data-bee-roamer][data-ready]").waitFor();
  assert.match(await page.title(), /Hivez/);
  assert.equal(await page.locator("[data-bee-roamer]").count(), 1);
  await page.screenshot({ path: path.join(output, "flight-start.png") });
  const start = center(await position(page));
  await page.waitForTimeout(8000);
  const stillMouse = center(await position(page));
  assert.ok(distance(start, stillMouse) > 6);
  check("Movement with mouse completely still", {
    start,
    afterEightSeconds: stillMouse,
  });
  for (let i = 0; i < 45; i++) {
    await page.mouse.move(i % 2 ? 40 : 1370, (i * 137) % 900);
    await page.waitForTimeout(35);
  }
  assert.equal(await page.evaluate(() => window.__beeInputListeners), 0);
  assert.notEqual(
    await page.locator("body").evaluate((e) => getComputedStyle(e).cursor),
    "none",
  );
  check(
    "Rapid mouse movement ignored",
    "No application mousemove/pointermove listener; bee keeps its independent continuous trajectory",
  );
  await page.waitForTimeout(22000);
  await page.screenshot({ path: path.join(output, "flight-later.png") });
  const initialTrace = await page.evaluate(() => window.__beeTrace);
  report.realTimeTrace = initialTrace.samples;
  const directions = new Set();
  for (let i = 1; i < initialTrace.samples.length; i++) {
    const a = initialTrace.samples[i - 1],
      b = initialTrace.samples[i];
    if (b.x - a.x > 0.2) directions.add("right");
    if (a.x - b.x > 0.2) directions.add("left");
    if (b.y - a.y > 0.2) directions.add("down");
    if (a.y - b.y > 0.2) directions.add("up");
  }
  assert.ok(directions.size >= 3, `Observed directions: ${[...directions]}`);
  const horizontalFlight = [];
  for (let i = 1; i < initialTrace.samples.length; i++) {
    const a = initialTrace.samples[i - 1],
      b = initialTrace.samples[i],
      dx = b.x - a.x;
    if (Math.abs(dx) > 4) horizontalFlight.push(dx * b.orientationX < 0);
  }
  const facingMatches = horizontalFlight.filter(Boolean).length;
  assert.ok(
    facingMatches >= Math.max(3, Math.ceil(horizontalFlight.length * 0.8)),
    `Bee faced against horizontal travel in ${horizontalFlight.length - facingMatches}/${horizontalFlight.length} samples`,
  );
  assert.ok(initialTrace.maxStep < 8);
  assert.deepEqual(initialTrace.outside, []);
  check("Natural real-time flight", {
    observedDirections: [...directions],
    forwardFacingSamples: facingMatches,
    horizontalSamples: horizontalFlight.length,
    samples: initialTrace.samples.length,
    maxFrameStep: initialTrace.maxStep,
  });
  for (const selector of [
    ".hz-manifesto",
    ".hz-journey",
    ".hz-hives",
    ".hz-community",
    ".hz-faq",
    ".hz-footer",
  ]) {
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    const p = await position(page);
    assert.ok(
      p.x >= 0 && p.y >= 0 && p.x + p.width <= 1441 && p.y + p.height <= 961,
    );
  }
  check(
    "Viewport flight while scrolling",
    "Observed all landing sections through the footer; artwork remains on screen",
  );
  for (const [width, height] of [
    [390, 844],
    [320, 480],
    [240, 280],
    [844, 390],
    [768, 600],
    [1440, 960],
    [320, 320],
    [1920, 1080],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    const p = await position(page);
    assert.ok(
      p.x >= -0.5 &&
        p.y >= -0.5 &&
        p.x + p.width <= width + 0.5 &&
        p.y + p.height <= height + 0.5,
    );
  }
  await page.waitForTimeout(4000);
  const afterResize = await page.evaluate(() => window.__beeTrace);
  assert.deepEqual(afterResize.outside, []);
  check("Repeated resize containment", {
    sizes: "240×280 through 1920×1080, portrait and landscape",
    framesOutsideViewport: afterResize.outside.length,
  });
  const honey = afterResize.samples.filter(
    (s) => Math.abs(s.fieldX - s.x) < 5 && Math.abs(s.fieldY - s.y) < 5,
  ).length;
  assert.ok(honey / afterResize.samples.length > 0.97);
  check("Honeycomb follows actual bee centre", {
    matchingSamples: honey,
    totalSamples: afterResize.samples.length,
    tolerancePixels: 5,
  });
  const media = await page.locator(".hz-bee-art").evaluate((c) => {
    const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let transparent = 0,
      opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent++;
      else opaque++;
    }
    const v = c.previousElementSibling;
    return {
      source: new URL(v.src).pathname,
      muted: v.muted,
      width: c.width,
      height: c.height,
      transparent,
      opaque,
    };
  });
  assert.equal(media.source, "/assets/bee-fly.webm");
  assert.ok(media.transparent > 1000 && media.opaque > 1000);
  const hash = createHash("sha256")
    .update(await fs.readFile("public/assets/bee-fly.webm"))
    .digest("hex");
  assert.equal(
    hash,
    "501111bc4a6a1b1d1ed6a752aea9d70a61705301001437600948834eac7355fd",
  );
  check("Original artwork and transparency", { sha256: hash, ...media });
  await page.evaluate(() => scrollTo(0, 0));
  await page
    .getByRole("button", { name: "Pause animations", exact: true })
    .click();
  await page.waitForTimeout(200);
  const rest = await position(page);
  await page.mouse.move(20, 200);
  await page.waitForTimeout(900);
  assert.deepEqual(await position(page), rest);
  assert.equal(
    await page.locator(".hz-bee-video").evaluate((e) => e.paused),
    true,
  );
  check(
    "Reduced motion",
    "Artwork, position and honeycomb freeze without following the mouse",
  );
  await page
    .getByRole("button", { name: "Enable animations", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore example: Lost pets", exact: true })
    .click();
  assert.match(await page.locator("#hz-map-example").innerText(), /More eyes/);
  await page
    .getByRole("link", { name: "Find your people", exact: true })
    .click();
  await page.locator('input[type="email"]').waitFor();
  assert.equal(await page.locator("[data-bee-roamer]").count(), 0);
  check(
    "Controls and route cleanup",
    "Map pin and signup CTA work; roaming component unmounts on auth route",
  );
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const touchPage = await mobile.newPage();
  await touchPage.goto(base, { waitUntil: "networkidle" });
  await touchPage.locator("[data-bee-roamer][data-ready]").waitFor();
  const touchStart = await position(touchPage);
  await touchPage.waitForTimeout(6500);
  const touchEnd = await position(touchPage);
  assert.ok(distance(center(touchStart), center(touchEnd)) > 2);
  assert.equal(
    Math.round(
      await touchPage
        .locator("[data-bee-roamer]")
        .evaluate((e) => e.getBoundingClientRect().width),
    ),
    128,
  );
  await touchPage.getByRole("button", { name: "Open menu" }).tap();
  assert.equal(await touchPage.locator("dialog").evaluate((e) => e.open), true);
  await touchPage.getByRole("button", { name: "Close menu" }).tap();
  await touchPage.screenshot({ path: path.join(output, "touch-flight.png") });
  await touchPage.emulateMedia({ reducedMotion: "reduce" });
  await touchPage.waitForTimeout(100);
  const touchRest = await position(touchPage);
  await touchPage.waitForTimeout(500);
  assert.deepEqual(await position(touchPage), touchRest);
  check("Touch and system reduced motion", {
    touchStart,
    touchEnd,
    width: 128,
    menuTap: "passed",
    liveSystemPreference: "stationary",
  });
  await mobile.close();
  // This automation runtime keeps actual tabs visible even when backgrounded.
  // Exercise the real handler with an explicit, isolated visibility simulation.
  await page.goto(base);
  await page.locator("[data-bee-roamer][data-ready]").waitFor();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(
    () => document.querySelector(".hz-bee-video").paused,
  );
  const pausedAt = await position(page);
  await page.waitForTimeout(700);
  assert.deepEqual(await position(page), pausedAt);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(
    () => !document.querySelector(".hz-bee-video").paused,
  );
  assert.ok((await page.evaluate(() => window.__beeTrace.maxStep)) < 8);
  check(
    "Visibility handler (simulated document.hidden)",
    "Hidden-state handler pauses position, field and video; visible-state handler resumes without a frame jump",
  );
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.networkFailures, []);
  check(
    "Console/network",
    "No browser errors or failed HTTP responses in tested flows",
  );
} catch (error) {
  report.failure = error.stack;
  console.error(error.stack);
  await page
    .screenshot({ path: path.join(output, "failure.png") })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await context.close();
  const video = page.video();
  if (video) {
    await video.saveAs(path.join(output, "flight-browser-recording.webm"));
  }
  await fs.writeFile(
    path.join(output, "browser-results.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
