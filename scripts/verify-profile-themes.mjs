import assert from "node:assert/strict";
import fs from "node:fs/promises";
const { chromium } = await import(process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright");
const base = process.argv[2] || "http://localhost:5173";
const out = process.argv[3] || "artifacts/profile-themes/final";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ ...(process.env.HIVEZ_CHROME_PATH ? { executablePath: process.env.HIVEZ_CHROME_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => {
  // One initial preference, not a forced override on every navigation.
  if (!localStorage.getItem("hivez-public-theme")) localStorage.setItem("hivez-public-theme", "light");
  localStorage.setItem("hivez-theme", "dark");
});
const page = await context.newPage();
const report = { base, checks: [], errors: [], localFailures: [], accessibility: [] };
const check = (name, evidence) => { report.checks.push({ name, evidence }); console.log("PASS", name); };
page.on("pageerror", e => report.errors.push(e.message));
page.on("console", m => { if (m.type() === "error") report.errors.push(m.text()); });
page.on("response", r => { if (r.url().startsWith(base) && r.status() >= 400) report.localFailures.push({ url: r.url(), status: r.status() }); });
async function theme(value, root = ".ha-page") {
  for (let i = 0; i < 3 && await page.locator(root).getAttribute("data-public-theme") !== value; i++) await page.locator("[data-public-theme-toggle]").click();
  assert.equal(await page.locator(root).getAttribute("data-public-theme"), value);
  await page.waitForTimeout(350);
}
async function shot(name) { await page.screenshot({ path: `${out}/${name}.png`, fullPage: true }); }
async function audit(view, mode, width, root) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${view} overflow at ${width}`);
  if (!process.env.HIVEZ_AXE_PATH) return;
  await page.addScriptTag({ path: process.env.HIVEZ_AXE_PATH });
  const result = await page.evaluate(root => window.axe.run(document.querySelector(root), { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }), root);
  report.accessibility.push({ view, mode, width, violations: result.violations.map(v => ({ id: v.id, help: v.help, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })) });
  console.log("AXE", view, mode, width, result.violations.length);
}
try {
  await page.goto(`${base}/tests/browser/profile-preview.html`, { waitUntil: "networkidle" });
  await page.locator("#cp-form").waitFor();
  assert.equal(await page.locator("[data-bee-roamer]").count(), 0);
  assert.equal(await page.locator(".ha-bee").count(), 1);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").innerText(), "Skip to form");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(":focus").getAttribute("id"), "cp-form");
  await page.getByRole("button", { name: "Enter my hive" }).click();
  assert.match(await page.getByRole("alert").innerText(), /at least 3/);
  assert.equal(await page.locator(":focus").getAttribute("id"), "cp-username");
  check("Profile entry and validation", "Keyboard skip targets the form; short/empty handles focus the username with an associated error. One anchored original bee, no roaming layer.");
  await page.getByLabel(/Choose your username/).fill("@@Neighbour");
  await page.getByLabel(/A little about you/).fill("Here for cleaner streets and good company.");
  assert.equal(await page.locator(".cp-preview-identity h3").innerText(), "@neighbour");
  assert.match(await page.locator(".cp-preview-bio").innerText(), /cleaner streets/);
  await page.getByRole("button", { name: "Avatar", exact: true }).click();
  assert.equal(await page.getByRole("button", { name: /^Choose Avatar/ }).count(), 12);
  await page.waitForFunction(() => [...document.querySelectorAll(".hivez-profile-avatar-option img")].every(e => e.complete && e.naturalWidth > 0));
  await page.getByRole("button", { name: "Choose Avatar 3", exact: true }).click();
  assert.equal(await page.locator(":focus").innerText(), "Avatar");
  assert.equal(await page.locator(".cp-progress i[data-complete=true]").count(), 3);
  await shot("profile-filled");
  await page.getByRole("button", { name: "Remove image" }).click();
  await page.getByLabel("Upload profile photo", { exact: true }).setInputFiles({ name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
  assert.match(await page.getByRole("alert").innerText(), /valid image/);
  await page.getByLabel("Upload profile photo", { exact: true }).setInputFiles({ name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  assert.match(await page.getByRole("alert").innerText(), /5MB/);
  const photo = "public/avatars/1958311d-8559-4a64-9203-dc3fb355a8d6.jpg";
  await page.evaluate(() => { window.__profileTest.mode = "upload-error"; });
  await page.getByLabel("Upload profile photo", { exact: true }).setInputFiles(photo);
  await page.getByText("Profile photo upload failed. Please try again.", { exact: true }).waitFor();
  await page.evaluate(() => { window.__profileTest.mode = "success"; });
  const chooserEvent = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Camera", exact: true }).click();
  const chooser = await chooserEvent;
  await chooser.setFiles(photo);
  await page.getByRole("button", { name: "Remove image" }).waitFor();
  assert.equal(await page.getByLabel("Take profile photo").getAttribute("capture"), "environment");
  assert.equal(await page.locator(".hivez-profile-preview-image").evaluate(e => e.complete && e.naturalWidth > 0), true);
  const photoBounds = await page.locator(".hivez-profile-preview-shell").boundingBox();
  assert.equal(photoBounds.width, photoBounds.height, "Profile image must remain circular after upload");
  check("Profile photo controls", "All 12 local avatars loaded; select/remove works. Invalid type and >5MB are rejected. Upload failure recovers. Camera opens the capture file input; selected image updates preview through an isolated callback. Native mobile camera and real Cloudinary upload not claimed.");
  await page.evaluate(() => { window.__profileTest.mode = "taken"; });
  await page.getByRole("button", { name: "Enter my hive" }).click();
  await page.getByText("That username is already taken. Try another.", { exact: true }).waitFor();
  assert.equal(await page.locator(":focus").getAttribute("id"), "cp-username");
  assert.equal(await page.getByLabel(/Choose your username/).inputValue(), "@@Neighbour");
  await page.evaluate(() => { window.__profileTest.mode = "save-error"; });
  await page.getByRole("button", { name: "Enter my hive" }).click();
  await page.getByText(/We couldn’t save your profile/).waitFor();
  await page.evaluate(() => { window.__profileTest.mode = "success"; });
  await page.getByRole("button", { name: "Enter my hive" }).click();
  await page.getByRole("button", { name: "Enter my hive" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Enter my hive" }).isEnabled(), true);
  const saved = await page.evaluate(() => window.__profileTest.saved);
  assert.equal(saved.length, 3);
  assert.equal(saved[2].username, "neighbour");
  assert.match(saved[2].bio, /cleaner streets/);
  check("Save response states", "Unavailable username and general failures retain entered details, clear loading and allow retry. Success callback receives normalized username, selected photo and bio. Fixture makes no account writes; service/gate contract verified separately in Vitest.");
  await page.getByLabel(/Choose your username/).blur();
  await page.waitForTimeout(4500);
  await page.getByRole("button", { name: "Say hi to the Hivez bee" }).click();
  assert.equal(await page.locator(".ha-bee").getAttribute("data-bee-clip"), "wave");
  await page.waitForFunction(() => { const v = document.querySelector('.ha-bee video'); return v && v.currentTime > 0.1 && !v.paused; });
  await shot("profile-bee-wave");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => document.querySelector(".ha-bee")?.getAttribute("data-bee-clip") === "still");
  assert.equal(await page.locator(".ha-bee").getAttribute("data-bee-clip"), "still");
  assert.equal(await page.locator(".ha-bee video").count(), 0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  check("Original bee reactions", "Actual original wave video advances on click; reduced motion replaces playback with the unchanged still artwork. No autonomous flight on onboarding.");
  for (const mode of ["light", "forest", "midnight"]) {
    await theme(mode);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await audit("complete-profile", mode, width, ".ha-page");
      await shot(`profile-${mode}-${width}`);
    }
  }
  for (const width of [320, 768, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  }
  check("Profile responsive layouts", "No horizontal overflow at 320, 390, 768, 1024 and 1440px; all three palettes captured at desktop and mobile sizes.");
  for (const route of ["/", "/login", "/signup"]) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + route, { waitUntil: "networkidle" });
    const root = route === "/" ? ".hz-landing" : ".ha-page";
    for (const mode of ["light", "forest", "midnight"]) {
      await theme(mode, root);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await audit(route, mode, width, root);
        await shot(`${route === "/" ? "landing" : route.slice(1)}-${mode}-${width}`);
      }
    }
    assert.equal(await page.evaluate(() => localStorage.getItem("hivez-theme")), "dark");
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator(root).getAttribute("data-public-theme"), "midnight");
  }
  check("Three-way public themes", "Landing, login, signup and profile completion cycle warm light → forest → black/yellow → warm light. All three audited at 1440/390px. Choice survives route navigation and reload. App's hivez-theme remains dark.");
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  assert.equal(await page.locator(".ha-page").getAttribute("data-public-theme"), "midnight");
  await page.getByRole("link", { name: "Sign up", exact: true }).click();
  assert.equal(await page.locator(".ha-page").getAttribute("data-public-theme"), "midnight");
  check("Auth navigation retains theme", "Client-side login → signup switch keeps black/yellow selected.");
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.localFailures, []);
  assert.ok(report.accessibility.every(x => x.violations.length === 0), "Accessibility violations recorded");
} finally {
  await fs.writeFile(`${out}/browser-results.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
