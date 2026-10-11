// Real application + real Firebase emulators, isolated Chrome profile.
// Only the Firebase endpoint configuration is redirected in transit. No auth,
// Settings component, persistence service, or application result is mocked.
import { chromium } from "../../.audit/browser/node_modules/playwright/index.mjs";
import fs from "node:fs/promises";
import path from "node:path";

export const output = path.resolve(".audit/settings-browser");
export const project = "demo-hivez-settings";
export const origin = "http://localhost:5173";
const email = "settings-audit@example.invalid";
const password = "Isolated-Settings-Audit-2026";

export async function seedAccount() {
  const response = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  let account = await response.json();
  if (!response.ok && account.error?.message === "EMAIL_EXISTS") {
    account = await (
      await fetch(
        "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
      )
    ).json();
  }
  if (!account.localId) throw new Error(JSON.stringify(account));
  const profile = {
    displayName: "Settings Audit",
    username: "settings-audit",
    profileCompleted: true,
    photoURL: "/src/assets/auth/newbee2.png",
    bio: "Local emulator test account",
    followers: 0,
    following: 0,
    posts: 0,
    privacy: {
      account: "public",
      messages: "everyone",
      mentions: "everyone",
      comments: "everyone",
      discoverable: true,
    },
    notificationPreferences: {
      likes: true,
      comments: true,
      reHives: true,
      mentions: true,
      follows: true,
      messages: true,
    },
    preferences: {
      sensitiveContent: "show",
      topics: [],
      interests: [],
      language: "en-US",
    },
  };
  function field(value) {
    if (typeof value === "string") return { stringValue: value };
    if (typeof value === "boolean") return { booleanValue: value };
    if (typeof value === "number") return { integerValue: String(value) };
    if (Array.isArray(value))
      return { arrayValue: { values: value.map(field) } };
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, field(item)]),
        ),
      },
    };
  }
  const saved = await fetch(
    `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/users/${account.localId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(profile).map(([key, value]) => [key, field(value)]),
        ),
      }),
    },
  );
  if (!saved.ok) throw new Error(await saved.text());
  return account.localId;
}

export async function openSession({
  viewport = { width: 1440, height: 900 },
} = {}) {
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });
  const context = await browser.newContext({ viewport, colorScheme: "light" });
  const evidence = {
    browser: await browser.version(),
    console: [],
    exceptions: [],
    blocked: [],
    failedRequests: [],
  };
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      ![
        "localhost:5173",
        "127.0.0.1:5173",
        "127.0.0.1:8080",
        "127.0.0.1:9099",
      ].includes(url.host)
    ) {
      evidence.blocked.push({
        url: url.origin + url.pathname,
        method: route.request().method(),
      });
      return route.abort("blockedbyclient");
    }
    if (url.pathname === "/src/firebase/firebase.ts") {
      const response = await route.fetch();
      let body = (await response.text()).split("//# sourceMappingURL=")[0];
      body = body
        .replace(
          "getAuth, GoogleAuthProvider",
          "getAuth, GoogleAuthProvider, connectAuthEmulator",
        )
        .replace("getFirestore }", "getFirestore, connectFirestoreEmulator }")
        .replace('projectId: "hivez-21680"', `projectId: "${project}"`)
        .replace(/apiKey: "[^"]+"/, 'apiKey: "demo-key"');
      body +=
        '\nconnectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });\nconnectFirestoreEmulator(db, "127.0.0.1", 8080);\n';
      return route.fulfill({ response, body });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type()))
      evidence.console.push({
        type: message.type(),
        text: message.text(),
        url: page.url(),
      });
  });
  page.on("pageerror", (error) =>
    evidence.exceptions.push({ message: error.message, url: page.url() }),
  );
  page.on("requestfailed", (request) =>
    evidence.failedRequests.push({
      url: request.url().split("?")[0],
      reason: request.failure()?.errorText,
    }),
  );
  await page.goto(`${origin}/login`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(origin + "/", { timeout: 30000 });
  await page.goto(`${origin}/settings`);
  await page.getByRole("heading", { name: "Your hive. Your way." }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { browser, context, page, evidence };
}

export async function go(page, route) {
  if (
    !route ||
    route === "saved" ||
    route === "activity" ||
    !page.url().startsWith(`${origin}/settings`)
  ) {
    await page.goto(`${origin}/settings${route ? "/" + route : ""}`);
  } else {
    const sidebarLink = page.locator(
      `.settings-sidebar-link[href="/settings/${route}"]`,
    );
    if (await sidebarLink.isVisible()) await sidebarLink.click();
    else
      await page
        .getByLabel("Settings category")
        .selectOption(`/settings/${route}`);
  }
  if (route === "saved" || route === "activity") {
    await page.waitForURL(`${origin}/${route}`);
    return;
  }
  const expectedHeading = {
    "": "Your hive. Your way.",
    account: "Account",
    privacy: "Privacy",
    security: "Security",
    notifications: "Notifications",
    content: "Content preferences",
    appearance: "Appearance",
    accessibility: "Accessibility",
    language: "Language",
    data: "Data",
    delete: "Delete / deactivate",
  }[route];
  await page.waitForURL(`${origin}/settings${route ? `/${route}` : ""}`);
  await page.waitForFunction(
    (expected) =>
      document.querySelector(".settings-page-heading h1")?.textContent?.trim() ===
      expected,
    expectedHeading,
  );
  await page.evaluate(() => document.fonts.ready);
}
