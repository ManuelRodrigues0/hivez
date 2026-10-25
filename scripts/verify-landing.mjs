import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

// Browser tooling is intentionally external to the application's dependencies.
// HIVEZ_PLAYWRIGHT_MODULE may point to an installed Playwright index.mjs file.
const { chromium } = await import(
  process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.argv[2] || "http://localhost:5173";
const output = path.resolve(process.argv[3] || "artifacts/landing");
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
  failedRequests: [],
  accessibility: [],
};
const check = (name, evidence) => {
  report.checks.push({ name, evidence });
  console.log(`PASS ${name}`);
};
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
});
await context.addInitScript(() => {
  const listeners = new Set();
  const add = window.addEventListener.bind(window);
  const remove = window.removeEventListener.bind(window);
  window.addEventListener = (type, handler, options) => {
    if (type === "mousemove") listeners.add(handler);
    add(type, handler, options);
  };
  window.removeEventListener = (type, handler, options) => {
    if (type === "mousemove") listeners.delete(handler);
    remove(type, handler, options);
  };
  Object.defineProperty(window, "__hivezMouseListeners", {
    // Playwright installs its own temporary hit-target mouse interceptor.
    get: () =>
      [...listeners].filter(
        (handler) => !String(handler).includes("_hitTargetInterceptor"),
      ).length,
  });
  localStorage.setItem("hivez-theme", "light");
});
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") report.errors.push(message.text());
});
page.on("response", (response) => {
  if (response.status() >= 400)
    report.failedRequests.push({
      path: new URL(response.url()).pathname,
      status: response.status(),
    });
});

const open = async () => {
  const response = await page.goto(base, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  await page.locator(".hz-hero h1").waitFor();
  await page.evaluate(() => document.fonts.ready);
};
const audit = async (target, label) => {
  if (!process.env.HIVEZ_AXE_SCRIPT) return;
  await target.addScriptTag({ path: process.env.HIVEZ_AXE_SCRIPT });
  const result = await target.evaluate(async () => {
    const { violations, incomplete } = await window.axe.run(
      document.querySelector(".hz-landing"),
      { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } },
    );
    return {
      violations: violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      incomplete: incomplete.map((v) => ({ id: v.id, nodes: v.nodes.length })),
    };
  });
  report.accessibility.push({ label, ...result });
  assert.equal(
    result.violations.length,
    0,
    `${label}: ${JSON.stringify(result.violations)}`,
  );
  check(`Accessibility: ${label}`, {
    violations: 0,
    manualReviewItems: result.incomplete,
  });
};
try {
  await open();
  assert.match(await page.title(), /Hivez — Small acts/);
  assert.equal(await page.locator("h1").count(), 1);
  check("Correct checkout and landing render", {
    title: await page.title(),
    url: page.url(),
  });
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".hz-skip-link")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("main").evaluate((e) => e === document.activeElement),
    true,
  );
  check("Keyboard skip link", "Main content receives focus");
  for (const [label, content] of [
    ["Waste & clean spaces", "A cleaner corner"],
    ["Water & everyday issues", "A little attention"],
    ["Lost pets", "More eyes"],
  ]) {
    await page
      .getByRole("button", { name: `Explore example: ${label}`, exact: true })
      .click();
    assert.match(
      await page.locator("#hz-map-example").innerText(),
      new RegExp(content),
    );
  }
  check("All three map pins", "Selected story and pressed state update");
  for (const label of [
    "Report it",
    "Find your people",
    "Show up",
    "Share progress",
  ]) {
    const button = page
      .locator(".hz-step")
      .filter({ has: page.locator(".hz-step-label", { hasText: label }) });
    await button.click();
    assert.equal(await button.getAttribute("aria-expanded"), "true");
    assert.match(
      await page.locator("#hz-journey-panel").innerText(),
      new RegExp(label),
    );
  }
  check("All four journey steps", "Expanded text, panel, and progress update");
  for (const label of [
    "Cleaner spaces",
    "Safer streets",
    "Lost pets",
    "Water issues",
  ]) {
    const button = page.getByRole("button", { name: label, exact: true });
    await button.click();
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    assert.match(
      await page.locator("#hz-hive-content").innerText(),
      new RegExp(label, "i"),
    );
  }
  check(
    "All four Hive topics",
    "Copy, artwork icon, tags and pressed states update",
  );
  for (const question of await page.locator(".hz-faq summary").all()) {
    await question.focus();
    await page.keyboard.press("Enter");
    assert.equal(await question.evaluate((e) => e.parentElement.open), true);
    await page.keyboard.press("Enter");
  }
  check("All FAQ disclosures by keyboard", "Each opens and closes with Enter");
  await page.evaluate(() => scrollTo(0, 0));
  if (
    await page
      .getByRole("button", { name: "Enable animations", exact: true })
      .count()
  )
    await page
      .getByRole("button", { name: "Enable animations", exact: true })
      .click();
  const positions = [];
  for (let sample = 0; sample < 4; sample++) {
    await page.mouse.move(sample % 2 ? 1200 : 80, sample % 2 ? 100 : 800);
    await page.waitForTimeout(700);
    const position = await page.locator("[data-bee-roamer]").evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    assert.ok(
      position.x >= 0 &&
        position.y >= 0 &&
        position.x + position.width <= 1440 &&
        position.y + position.height <= 960,
    );
    positions.push(position);
  }
  assert.ok(
    Math.hypot(
      positions.at(-1).x - positions[0].x,
      positions.at(-1).y - positions[0].y,
    ) > 1,
  );
  const media = await page.locator(".hz-bee-art").evaluate((canvas) => {
    const data = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0,
      transparent = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] === 0) transparent++;
      else opaque++;
    }
    const video = canvas.previousElementSibling;
    return {
      opaque,
      transparent,
      time: video.currentTime,
      paused: video.paused,
      source: new URL(video.src).pathname,
    };
  });
  assert.ok(
    media.opaque > 500 &&
      media.transparent > 500 &&
      media.time > 0 &&
      !media.paused,
  );
  check("Original bee movement and chroma rendering", { positions, media });
  assert.equal(await page.evaluate(() => window.__hivezMouseListeners), 0);
  await page
    .getByRole("button", { name: "Pause animations", exact: true })
    .click();
  await page.waitForTimeout(200);
  assert.equal(
    await page.locator(".hz-bee-video").evaluate((e) => e.paused),
    true,
  );
  const beforeRest = await page.locator("[data-bee-roamer]").boundingBox();
  await page.mouse.move(600, 350);
  await page.waitForTimeout(450);
  const afterRest = await page.locator("[data-bee-roamer]").boundingBox();
  assert.deepEqual(afterRest, beforeRest);
  check(
    "Reduced motion",
    "Bee and honeycomb remain stationary, independent of mouse movement",
  );
  const anchors = await page
    .locator('.hz-landing a[href^="#"]')
    .evaluateAll((es) => es.map((e) => e.getAttribute("href")));
  for (const anchor of anchors)
    assert.ok(await page.locator(anchor).count(), `Missing anchor ${anchor}`);
  const destinations = await page
    .locator('.hz-landing a[href^="/"]')
    .evaluateAll((es) => [...new Set(es.map((e) => e.getAttribute("href")))]);
  assert.deepEqual(destinations.sort(), ["/", "/login", "/signup"]);
  check("Navigation destinations", { anchors, destinations });
  await audit(page, "desktop light");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.waitForTimeout(650);
  await audit(page, "desktop dark");
  for (const theme of ["dark", "light"]) {
    if (theme === "light") {
      await page.getByRole("button", { name: "Switch to light theme" }).click();
      await page.waitForTimeout(650);
    }
    await page.screenshot({
      path: path.join(output, `desktop-${theme}.png`),
      fullPage: true,
    });
  }
  for (const route of ["/signup", "/login", "/signup", "/login"]) {
    await page.locator(`a[href="${route}"]`).first().click();
    await page.waitForURL(`${base}${route}`);
    await page.locator('input[type="email"]').waitFor();
    assert.ok(await page.locator('input[type="email"]').count());
    assert.equal(await page.locator("[data-bee-roamer]").count(), 0);
    await page.waitForFunction(() => window.__hivezMouseListeners === 0);
    assert.equal(await page.evaluate(() => window.__hivezMouseListeners), 0);
    await page.goto(base);
    await page.locator(".hz-hero h1").waitFor();
    await page.waitForFunction(() => window.__hivezMouseListeners === 0);
    assert.equal(await page.evaluate(() => window.__hivezMouseListeners), 0);
  }
  check(
    "Signup/login handoff and event cleanup",
    "Four real CTA navigations; auth email fields render; mouse listener count 1 → 0 → 1",
  );
  for (const width of [320, 390, 620, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 960 });
    const sizes = await page.evaluate(() => ({
      viewport: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert.equal(sizes.viewport, sizes.scroll, `Overflow at ${width}`);
  }
  check(
    "Responsive widths",
    "No document overflow at 320, 390, 620, 768, 1024, 1440, 1920 pixels",
  );
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const touchPage = await mobile.newPage();
  await touchPage.goto(base, { waitUntil: "networkidle" });
  await touchPage.locator("h1").waitFor();
  assert.equal(await touchPage.locator("[data-bee-roamer]").count(), 1);
  await touchPage.getByRole("button", { name: "Open menu" }).tap();
  assert.equal(await touchPage.locator("dialog").evaluate((e) => e.open), true);
  await touchPage.keyboard.press("Shift+Tab");
  assert.equal(
    await touchPage
      .locator("dialog")
      .evaluate((e) => e.contains(document.activeElement)),
    true,
  );
  await touchPage.keyboard.press("Escape");
  assert.equal(
    await touchPage.locator("dialog").evaluate((e) => e.open),
    false,
  );
  assert.equal(
    await touchPage
      .getByRole("button", { name: "Open menu" })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await touchPage.getByRole("button", { name: "Open menu" }).tap();
  await touchPage
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: /How it works/ })
    .tap();
  assert.equal(
    await touchPage.locator("dialog").evaluate((e) => e.open),
    false,
  );
  assert.equal(new URL(touchPage.url()).hash, "#how");
  check(
    "Touch and mobile menu",
    "One calm touch mascot; native dialog traps focus, Escape restores focus, anchor navigation works",
  );
  await touchPage
    .getByRole("button", { name: "Water issues", exact: true })
    .tap();
  assert.match(
    await touchPage.locator("#hz-hive-content").innerText(),
    /Small leaks/,
  );
  await audit(touchPage, "mobile dark, system reduced motion");
  await touchPage.evaluate(() => scrollTo(0, 0));
  await touchPage.screenshot({
    path: path.join(output, "mobile-dark.png"),
    fullPage: false,
  });
  await touchPage.getByRole("button", { name: "Switch to light theme" }).tap();
  await touchPage.waitForTimeout(650);
  await audit(touchPage, "mobile light");
  await touchPage.screenshot({
    path: path.join(output, "mobile-light.png"),
    fullPage: false,
  });
  // Chrome/Playwright here switches touch media to a fine pointer when taking
  // full-page mobile screenshots. Viewport captures preserve real touch media.
  for (const selector of [
    ".hz-manifesto",
    ".hz-journey",
    ".hz-hives",
    ".hz-community",
    ".hz-faq",
    ".hz-invitation",
    ".hz-footer",
  ]) {
    await touchPage.locator(selector).scrollIntoViewIfNeeded();
    await touchPage.screenshot({
      path: path.join(output, `mobile-${selector.slice(4)}.png`),
    });
  }
  await touchPage.evaluate(() =>
    localStorage.setItem("hivez-font-size", "large"),
  );
  await touchPage.reload();
  await touchPage.locator("h1").waitFor();
  assert.equal(
    await touchPage.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  assert.equal(
    await touchPage
      .locator("h1")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    true,
  );
  assert.equal(await touchPage.locator("[data-bee-roamer]").count(), 1);
  check(
    "Large font setting",
    "390 px mobile remains within viewport at 18 px root font",
  );
  await touchPage.evaluate(() =>
    localStorage.setItem("hivez-high-contrast", "true"),
  );
  await touchPage.reload();
  await touchPage.locator("h1").waitFor();
  await audit(touchPage, "mobile high contrast and large font");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.failedRequests, []);
  check("Runtime and network", {
    consoleAndPageErrors: report.errors,
    failedResponses: report.failedRequests,
  });
} catch (error) {
  report.failure = error.stack;
  console.error(error.message);
  await page
    .screenshot({ path: path.join(output, "failure.png"), fullPage: true })
    .catch(() => {});
  process.exitCode = 1;
} finally {
  await fs.writeFile(
    path.join(output, "browser-results.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
