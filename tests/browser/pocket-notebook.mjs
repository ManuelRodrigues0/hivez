import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { openAppSession, origin, output, saveDoc } from "./app-session.mjs";
const dir = `${output}/notebook`;
await fs.mkdir(dir, { recursive: true });
const results = [];
const { browser, page, evidence } = await openAppSession({
  width: 1440,
  height: 1000,
  theme: "dark",
});
const editor = () =>
  page.getByRole("textbox", { name: "Your local draft", exact: true });
const next = () =>
  page.getByRole("button", { name: "Continue as a post", exact: true });
const note =
  "What if our street had a shared corner for plants?\nA local-only notebook test.";
async function check(name, run) {
  await run();
  results.push({ name, status: "passed" });
  console.log("PASS", name);
}
async function login(email, password) {
  await page.goto(origin + "/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(origin + "/");
  await editor().waitFor();
}
async function logout() {
  await page
    .locator(".hv-sidebar")
    .getByRole("button", { name: "Log out", exact: true })
    .click();
  await page.waitForTimeout(200);
}
try {
  await check(
    "Marked blocks are removed; posts start directly below the navbar",
    async () => {
      assert.equal(
        await page.locator(".hv-feed-tools,.hv-composer-prompt").count(),
        0,
      );
      assert.equal(
        await page.getByText("YOUR NEIGHBOURHOOD", { exact: true }).count(),
        0,
      );
      assert.equal(
        await page.getByText("Find your people.", { exact: true }).count(),
        0,
      );
      const first = await page.locator(".app-feed-card").first().boundingBox();
      assert.ok(first.y <= 74);
      const bee = await page
        .locator(".hv-brand-bee")
        .evaluate((v) => ({
          width: v.getBoundingClientRect().width,
          fit: getComputedStyle(v).objectFit,
          source: v.currentSrc,
        }));
      assert.equal(bee.width, 124);
      assert.equal(bee.fit, "contain");
      assert.ok(bee.source.endsWith("/assets/hivez-ultra-bee.webm"));
      await page.screenshot({ path: `${dir}/empty-dark.png` });
    },
  );
  await check(
    "Prompt selection, keyboard focus and account-scoped device saving",
    async () => {
      assert.equal(await next().isDisabled(), true);
      await page
        .getByRole("group", { name: "Notebook starting point", exact: true })
        .getByRole("button", { name: "Offer", exact: true })
        .click();
      assert.equal(
        await editor().evaluate((el) => el === document.activeElement),
        true,
      );
      assert.equal(
        await editor().getAttribute("placeholder"),
        "I could lend a hand with...",
      );
      await editor().fill(note);
      await page.getByText("Saved on this device", { exact: true }).waitFor();
      await page
        .getByRole("group", { name: "Notebook starting point", exact: true })
        .getByRole("button", { name: "Ask", exact: true })
        .click();
      assert.equal(await editor().inputValue(), note);
      assert.ok(
        (
          await editor().evaluate((el) => getComputedStyle(el).backgroundImage)
        ).includes("repeating-linear-gradient"),
      );
      await page.reload();
      await editor().waitFor();
      assert.equal(await editor().inputValue(), note);
      await page.screenshot({ path: `${dir}/saved-dark.png` });
    },
  );
  const latest = note + " One final thought.";
  await check(
    "The last keystroke survives immediate handoff to the real post composer",
    async () => {
      await editor().fill(latest);
      await next().click();
      await page.waitForURL(origin + "/create");
      assert.equal(
        await page
          .getByRole("textbox", { name: "Post text", exact: true })
          .inputValue(),
        latest,
      );
      await page.screenshot({ path: `${dir}/composer-handoff.png` });
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.waitForURL(origin + "/");
      await editor().waitFor();
      assert.equal(await editor().inputValue(), latest);
    },
  );
  await check(
    "Different local test accounts do not see each other’s notebook",
    async () => {
      const email = "notebook-second@example.invalid",
        password = "Local-Notebook-Only-2026!";
      let account;
      for (const action of ["signUp", "signInWithPassword"]) {
        const r = await fetch(
          `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:${action}?key=demo-key`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
          },
        );
        account = await r.json();
        if (account.localId) break;
      }
      assert.ok(account.localId);
      await saveDoc(`users/${account.localId}`, {
        profileCompleted: true,
        displayName: "Notebook test two",
        username: "notebooktesttwo",
        photoURL: "/avatars/1958311d-8559-4a64-9203-dc3fb355a8d6.jpg",
        bio: "Local emulator fixture only.",
        privacy: { account: "public" },
      });
      await logout();
      await login(email, password);
      assert.equal(await editor().inputValue(), "");
      await editor().fill("A different account, a different notebook.");
      await page.getByText("Saved on this device", { exact: true }).waitFor();
      await logout();
      await login("design-test@example.invalid", "Local-Design-Only-2026!");
      assert.equal(await editor().inputValue(), latest);
    },
  );
  await check(
    "Sidebar links retain real map and volunteering destinations",
    async () => {
      const links = page.getByRole("navigation", {
        name: "Step into your neighbourhood",
        exact: true,
      });
      await links
        .getByRole("link", { name: /Look around your corner/ })
        .click();
      await page.waitForURL(origin + "/map");
      await page.goto(origin + "/");
      await editor().waitFor();
      await page
        .getByRole("navigation", {
          name: "Step into your neighbourhood",
          exact: true,
        })
        .getByRole("link", { name: /Put a little good/ })
        .click();
      await page.waitForURL(origin + "/volunteering");
    },
  );
  await check(
    "Storage failure is honest and does not prevent continuing a draft",
    async () => {
      await page.addInitScript(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (key.startsWith("hivez:pocket-notebook:"))
            throw new DOMException(
              "Test-only storage restriction",
              "QuotaExceededError",
            );
          return original.call(this, key, value);
        };
      });
      await page.goto(origin + "/");
      await editor().fill(
        "A draft still works when local saving is unavailable.",
      );
      await page
        .getByText("Device saving unavailable", { exact: true })
        .waitFor();
      await next().click();
      await page.waitForURL(origin + "/create");
      assert.equal(
        await page
          .getByRole("textbox", { name: "Post text", exact: true })
          .inputValue(),
        "A draft still works when local saving is unavailable.",
      );
    },
  );
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(
    evidence.console.filter((m) => m.type === "error"),
    [],
  );
} catch (error) {
  results.push({ status: "failed", message: error.message });
  await page.screenshot({ path: `${dir}/failure.png` });
  throw error;
} finally {
  await fs.writeFile(
    `${dir}/results.json`,
    JSON.stringify({ results, evidence }, null, 2),
  );
  await browser.close();
}
