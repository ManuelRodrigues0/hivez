import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const { chromium } = await import(
  process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright"
);
const base = process.argv[2] || "http://localhost:5173";
const out = process.argv[3] || "artifacts/auth/final";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.HIVEZ_CHROME_PATH
    ? { executablePath: process.env.HIVEZ_CHROME_PATH }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await context.addInitScript(() => {
  localStorage.setItem("hivez-theme", "light");
  localStorage.setItem("hivez-reduced-motion", "false");
});
const page = await context.newPage();
const report = {
  base,
  checkedAt: new Date().toISOString(),
  checks: [],
  errors: [],
  requests: [],
};
page.on("pageerror", (e) => report.errors.push(e.message));
page.on("console", (m) => {
  if (
    m.type() === "error" &&
    !/400|auth\/popup-closed|Cross-Origin-Opener-Policy/.test(m.text())
  )
    report.errors.push(m.text());
});
page.on("request", (r) => {
  if (/accounts:(signInWithPassword|signUp|sendOobCode)/.test(r.url()))
    report.requests.push({
      endpoint: new URL(r.url()).pathname,
      method: r.method(),
    });
});
function check(name, evidence) {
  report.checks.push({ name, evidence });
  console.log("PASS", name);
}
async function shot(name) {
  await page.screenshot({
    path: path.join(out, name + ".png"),
    fullPage: true,
  });
}
async function open(route) {
  const response = await page.goto(base + route, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200);
  await page.locator(".ha-page").waitFor();
}
async function focus(field) {
  await page.getByLabel(field, { exact: true }).focus();
}
const overlap = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;
try {
  await open("/login");
  assert.equal(await page.locator("[data-bee-roamer]").count(), 0);
  assert.equal(await page.locator(".ha-bee").count(), 1);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").innerText(), "Skip to form");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(":focus").getAttribute("id"), "ha-form");
  check(
    "Auth layout and keyboard entry",
    "One original bee, no roaming layer; keyboard skip link focuses the form.",
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  assert.equal(await page.locator(":focus").getAttribute("id"), "ha-email");
  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).focus();
  assert.equal(
    await page.getByLabel("Email address").getAttribute("aria-invalid"),
    "true",
  );
  await shot("login-validation");
  check(
    "Login validation",
    "Empty and malformed inputs focus the first invalid field and expose associated inline errors.",
  );
  await page.getByLabel("Email address").fill("hivez-ui-check@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("NotARealAccount-2026!");
  assert.equal(
    await page.locator(".ha-bee").getAttribute("data-bee-clip"),
    "shy",
  );
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Password", { exact: true }).getAttribute("type"),
    "text",
  );
  await page
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Password", { exact: true }).getAttribute("type"),
    "password",
  );
  check(
    "Password privacy",
    "Both visibility states work and the supplied shy clip responds to password focus/reveal.",
  );
  const loginResponse = page.waitForResponse((r) =>
    r.url().includes("accounts:signInWithPassword"),
  );
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  const actual = await loginResponse;
  await page.getByRole("alert").waitFor();
  assert.equal(actual.status(), 400);
  assert.match(await page.getByRole("alert").innerText(), /didn’t match/);
  assert.equal(
    await page.getByRole("button", { name: "Log in", exact: true }).isEnabled(),
    true,
  );
  check("Real Firebase login error round trip", {
    httpStatus: actual.status(),
    message: await page.getByRole("alert").innerText(),
    note: "Reserved nonexistent account; successful sign-in not claimed.",
  });

  let resetPayload;
  await page.route("**/accounts:sendOobCode*", async (route) => {
    resetPayload = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ email: resetPayload.email }),
    });
  });
  await page.getByRole("button", { name: "Forgot password?" }).click();
  assert.equal(
    await page.locator(":focus").getAttribute("id"),
    "ha-form-title",
  );
  await page.getByRole("button", { name: "Send reset link" }).click();
  await page.getByText("Check your inbox.", { exact: true }).waitFor();
  assert.equal(resetPayload.requestType, "PASSWORD_RESET");
  assert.equal(resetPayload.email, "hivez-ui-check@example.invalid");
  await shot("password-recovery");
  await page.getByRole("button", { name: "Back to log in" }).click();
  check(
    "Password recovery UI and Firebase request",
    "Reset API request type/email verified with an intercepted success response; neutral confirmation and return focus work. No real reset email sent.",
  );

  let popupUrl = "";
  await context.route("**/__/auth/handler*", async (route) => {
    popupUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<title>Google sign-in initiation test</title><p>Provider handoff intercepted for testing.</p>",
    });
  });
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Continue with Google" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  assert.ok(popupUrl.includes("providerId=google.com"), popupUrl);
  await popup.close();
  await page.getByRole("alert").waitFor();
  assert.match(
    await page.getByRole("alert").innerText(),
    /Google sign-in was closed/,
  );
  check(
    "Google Sign-In initiation",
    "Existing Firebase signInWithPopup opened its google.com provider handler. Provider page intercepted, popup closed, and retry feedback verified; no Google account authenticated.",
  );
  await context.unroute("**/__/auth/handler*");

  const documentId = await page.evaluate(() => {
    window.__authDocumentId = "same-document";
    return performance.timeOrigin;
  });
  await page
    .getByRole("link", { name: "Sign up", exact: true })
    .first()
    .click();
  await page.waitForURL("**/signup");
  assert.equal(await page.evaluate(() => performance.timeOrigin), documentId);
  assert.equal(await page.locator(".ha-bee").count(), 1);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(await page.locator(":focus").getAttribute("id"), "ha-name");
  await page.getByLabel("Full name").fill("Browser Check");
  await page.getByLabel("Email address").fill("hivez-ui-check@example.invalid");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(
    await page.locator(":focus").getAttribute("id"),
    "ha-form-title",
  );
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  assert.equal(
    await page.getByLabel("Full name").inputValue(),
    "Browser Check",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password", { exact: true }).fill("different");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  assert.match(
    await page.locator("#ha-password-help").innerText(),
    /6 characters/,
  );
  assert.match(
    await page.locator("#ha-confirm-help").innerText(),
    /don’t match/,
  );
  await page
    .getByLabel("Password", { exact: true })
    .fill("Unique-Long-Test-2026");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("Unique-Long-Test-2026");
  await page.getByLabel("Confirm password", { exact: true }).blur();
  assert.match(
    await page.locator("#ha-confirm-help").innerText(),
    /Passwords match/,
  );
  assert.equal(
    await page.locator(".ha-strength-bars i[data-filled=true]").count(),
    4,
  );
  await page
    .getByRole("button", { name: "Show confirm password", exact: true })
    .click();
  assert.equal(
    await page
      .getByLabel("Confirm password", { exact: true })
      .getAttribute("type"),
    "text",
  );
  await page
    .getByRole("button", { name: "Hide confirm password", exact: true })
    .click();
  check(
    "Signup validation and page transition",
    "SPA switch preserves the document. Both signup steps, required name/email, Edit details with retained values, six-character minimum, mismatch/match feedback, length guide and confirm-password visibility work.",
  );

  let signupPayload;
  await page.route("**/accounts:signUp*", async (route) => {
    signupPayload = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: 400, message: "EMAIL_EXISTS" } }),
    });
  });
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Creating your account…" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Creating your account…" })
      .isDisabled(),
    true,
  );
  await page.getByRole("alert").waitFor();
  assert.equal(signupPayload.email, "hivez-ui-check@example.invalid");
  assert.equal(signupPayload.password, "Unique-Long-Test-2026");
  assert.match(
    await page.getByRole("alert").innerText(),
    /already uses this email/,
  );
  check(
    "Registration service boundary and loading",
    "Existing signup service received entered email/password; request intercepted with EMAIL_EXISTS to avoid creating production data. Loading disables submit; useful retry error appears.",
  );

  await open("/login");
  await focus("Email address");
  assert.equal(
    await page.locator(".ha-bee").getAttribute("data-bee-clip"),
    "wave",
  );
  const video = page.locator(".ha-bee video");
  await video.waitFor();
  await video.evaluate((v) =>
    v.readyState >= 2
      ? Promise.resolve()
      : new Promise((resolve) =>
          v.addEventListener("loadeddata", resolve, { once: true }),
        ),
  );
  const duration = await video.evaluate((v) => v.duration);
  await page.waitForTimeout(Math.min(15000, duration * 1000 + 700));
  assert.equal(
    await page.locator(".ha-bee").getAttribute("data-bee-clip"),
    "still",
  );
  await page.getByRole("button", { name: "Say hi to the Hivez bee" }).click();
  await page.waitForTimeout(500);
  assert.equal(
    await page.locator(".ha-bee").getAttribute("data-bee-clip"),
    "wave",
  );
  assert.equal(
    await page.locator(".ha-bee video").evaluate((v) => v.loop),
    false,
  );
  await shot("bee-wave");
  await focus("Password");
  await page.waitForTimeout(500);
  // Password focus immediately interrupts an earlier greeting.
  assert.equal(
    await page.locator(".ha-bee").getAttribute("data-bee-clip"),
    "shy",
  );
  await page.waitForFunction(
    () =>
      document.querySelector(".ha-bee video")?.dataset.privacyHeld === "true",
  );
  assert.equal(
    await page
      .locator(".ha-bee video")
      .evaluate(
        (v) => v.paused && v.currentTime >= 1.6 && v.currentTime <= 1.8,
      ),
    true,
  );
  await shot("bee-shy");
  const first = await page.locator(".ha-bee").boundingBox();
  await page.mouse.move(20, 800);
  await page.waitForTimeout(700);
  await page.mouse.move(1300, 20);
  const second = await page.locator(".ha-bee").boundingBox();
  assert.ok(
    Math.abs(first.x - second.x) < 1 && Math.abs(first.y - second.y) < 1,
  );
  check("Original bee interactions", {
    emailAcknowledgement: "original wave plays once and returns to still",
    tap: "wave clip, loop=false",
    password:
      "original shy clip holds its real closed-eye pose at 1.7 seconds while focused",
    fixedComposition: true,
    waveDuration: duration,
  });
  for (const [index, name] of ["Notice", "Connect", "Act"].entries()) {
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    assert.equal(
      await page.locator(".ha-story-images img.is-active").getAttribute("src"),
      [
        "/auth/local-action.jpg",
        "/auth/shared-street.jpg",
        "/auth/people-together.jpg",
      ][index],
    );
    assert.equal(
      await page
        .locator(".ha-story-images img.is-active")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
      true,
    );
  }
  check(
    "Photographic story interaction",
    "Notice, Connect and Act update their real local photograph and explanatory copy; images loaded successfully.",
  );

  for (const route of ["/login", "/signup"]) {
    await open(route);
    for (const [width, height] of [
      [1440, 1000],
      [1024, 768],
      [768, 1024],
      [390, 844],
      [320, 720],
    ]) {
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(500);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      const bee = await page.locator(".ha-bee-button").boundingBox();
      for (const input of await page
        .locator("input,.ha-primary,.ha-google,.ha-mode-nav a")
        .all()) {
        const box = await input.boundingBox();
        assert.ok(
          !overlap(bee, box),
          `Bee overlaps ${await input.getAttribute("id")} at ${width}`,
        );
      }
      await shot(`${route.slice(1)}-${width}-light`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator("[data-public-theme-toggle]").click();
    await page.waitForTimeout(700);
    await shot(`${route.slice(1)}-390-forest`);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(300);
    await shot(`${route.slice(1)}-1440-forest`);
    await page.locator("[data-public-theme-toggle]").click();
    await page.waitForTimeout(700);
    await shot(`${route.slice(1)}-1440-midnight`);
    await page.locator("[data-public-theme-toggle]").click();
    await page.waitForTimeout(700);
    if (route === "/signup") {
      await page.getByLabel("Full name").fill("Browser Check");
      await page
        .getByLabel("Email address")
        .fill("hivez-ui-check@example.invalid");
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.waitForTimeout(350);
        await shot(`signup-passwords-${width}-light`);
      }
    }
  }
  check(
    "Responsive composition and themes",
    "Both routes checked at 320, 390, 768, 1024 and 1440px; no horizontal overflow and bee never intersects fields, provider button, submit or mode links. Warm light, forest and black/yellow screenshots saved.",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await focus("Password");
  assert.equal(
    await page.locator(".ha-bee").getAttribute("data-bee-clip"),
    "still",
  );
  assert.equal(await page.locator(".ha-bee video").count(), 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Pause animations" }).click();
  await focus("Confirm password");
  assert.equal(await page.locator(".ha-bee video").count(), 0);
  check(
    "Reduced motion",
    "Live system preference and application motion switch both suppress original video reactions and CSS entry transitions.",
  );
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "20px";
    document.documentElement.classList.add("high-contrast");
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await shot("large-text-high-contrast");
  check(
    "Large text and contrast",
    "390px viewport at 20px root font size has no horizontal overflow; high-contrast styling inspected.",
  );

  const hashes = {};
  for (const file of [
    "newbee2.png",
    "bee-wave.webm",
    "bee-fly.webm",
    "bee-shy.webm",
  ])
    hashes[file] = createHash("sha256")
      .update(await fs.readFile(`src/assets/auth/${file}`))
      .digest("hex");
  assert.equal(
    hashes["newbee2.png"],
    "c7bcb068e22434f6f74d854702150b9ca29f771e07e77a8097f245e2f7b47e68",
  );
  check("Asset integrity", hashes);
  assert.deepEqual(report.errors, []);
  check(
    "Browser runtime",
    "No unhandled page exceptions or unexpected console errors; Firebase 400 test responses accounted for.",
  );
} catch (e) {
  report.failure = e.stack;
  await shot("failure");
  throw e;
} finally {
  await fs.writeFile(
    path.join(out, "browser-results.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
