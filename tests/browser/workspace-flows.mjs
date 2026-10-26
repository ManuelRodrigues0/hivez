import assert from "node:assert/strict";
import fs from "node:fs/promises";
import {
  seedDesignData,
  openAppSession,
  origin,
  project,
  output,
} from "./app-session.mjs";
const uid = await seedDesignData();
const { browser, page, evidence } = await openAppSession();
const dir = `${output}/flows`;
await fs.mkdir(dir, { recursive: true });
const results = [];
let enabled = !process.argv[2];
async function check(name, action) {
  if (!enabled) {
    if (name.startsWith(process.argv[2])) enabled = true;
    else return;
  }
  await action();
  results.push({ name, status: "passed" });
  console.log("PASS", name);
}
async function open(path) {
  await page.goto(origin + path);
  await page.waitForTimeout(450);
}
async function documents(path) {
  const r = await fetch(
    `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/${path}`,
  );
  return (await r.json()).documents || [];
}
async function waitForDocuments(path, predicate) {
  for (let i = 0; i < 70; i++) {
    const list = await documents(path);
    if (predicate(list)) return list;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Timed out waiting for persisted documents: ${path}`);
}
async function waitForAttribute(locator, attribute, expected) {
  for (let i = 0; i < 90; i++) {
    if ((await locator.getAttribute(attribute)) === expected) return;
    await page.waitForTimeout(80);
  }
  assert.equal(await locator.getAttribute(attribute), expected);
}
const cleanupCard = () =>
  page
    .locator(".app-feed-card")
    .filter({ hasText: "A little care goes a long way." })
    .first();
try {
  await check("Shared chrome, keyboard entry and navigation", async () => {
    assert.equal(await page.locator(".hv-workspace").count(), 1);
    await page.keyboard.press("Tab");
    // Native document focus starts at the skip link after a fresh document.
    await page.locator(".hv-skip").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(":focus").getAttribute("id"), "hv-content");
    await page
      .getByRole("button", { name: "Search Hivez", exact: true })
      .click();
    await page.waitForURL(origin + "/search");
    await page
      .getByRole("textbox", { name: "Search people, posts, and hives" })
      .fill("sam");
    await page.getByText("Sam Rivera", { exact: true }).first().waitFor();
  });
  await check("Real feed filtering and empty state", async () => {
    await open("/hive/waste");
    await cleanupCard().waitFor();
    assert.equal(await page.locator(".app-feed-card").count(), 1);
    await open("/hive/blood-requests");
    await page
      .getByRole("heading", { name: "Every hive starts somewhere." })
      .waitFor();
    await open("/");
    await cleanupCard().waitFor();
  });
  await check(
    "Like state persists through the actual Firestore client",
    async () => {
      const hasLike = (list) =>
        list.some((doc) => doc.name.endsWith("/" + uid));
      const initial = hasLike(await documents("posts/local-cleanup/likes"));
      const like = () =>
        cleanupCard().getByRole("button", { name: /^(Like|Unlike) post$/ });
      await waitForAttribute(like(), "aria-pressed", String(initial));
      await like().click();
      await waitForDocuments(
        "posts/local-cleanup/likes",
        (list) => hasLike(list) !== initial,
      );
      await page.reload();
      await cleanupCard().waitFor();
      await waitForAttribute(like(), "aria-pressed", String(!initial));
      await like().click();
      await waitForDocuments(
        "posts/local-cleanup/likes",
        (list) => hasLike(list) === initial,
      );
    },
  );
  await check("Save and ReHive persistence", async () => {
    await open("/");
    const save = cleanupCard().getByRole("button", {
      name: /^(Save post|Remove from saved posts)$/,
    });
    const savedInitially = (await documents("savedPosts")).some(
      (x) =>
        x.fields.postId?.stringValue === "local-cleanup" &&
        x.fields.userId?.stringValue === uid,
    );
    await waitForAttribute(save, "aria-pressed", String(savedInitially));
    if ((await save.getAttribute("aria-pressed")) !== "true")
      await save.click();
    await cleanupCard()
      .getByRole("button", { name: "Remove from saved posts", exact: true })
      .waitFor();
    await page
      .locator(".hv-sidebar")
      .getByRole("link", { name: "Saved posts", exact: true })
      .click();
    await cleanupCard().waitFor();
    await waitForDocuments("savedPosts", (list) =>
      list.some((x) => x.fields.postId?.stringValue === "local-cleanup"),
    );
    await open("/");
    const rh = cleanupCard().getByRole("button", {
      name: /^(ReHive post|Remove ReHive)$/,
    });
    const rehivedInitially = (await documents("reHives")).some(
      (x) =>
        x.fields.postId?.stringValue === "local-cleanup" &&
        x.fields.userId?.stringValue === uid,
    );
    await waitForAttribute(rh, "aria-pressed", String(rehivedInitially));
    if ((await rh.getAttribute("aria-pressed")) !== "true") await rh.click();
    await cleanupCard()
      .getByRole("button", { name: "Remove ReHive", exact: true })
      .waitFor();
    await waitForDocuments("reHives", (list) =>
      list.some(
        (x) =>
          x.fields.postId?.stringValue === "local-cleanup" &&
          x.fields.userId?.stringValue === uid,
      ),
    );
    await open("/profile");
    await page.getByRole("button", { name: "ReHives", exact: true }).click();
    await page.locator(".hv-profile-tile").first().waitFor();
  });
  await check(
    "Replies: native focus, actual send, live result and Escape",
    async () => {
      await open("/");
      await cleanupCard()
        .getByRole("button", { name: "Comments", exact: true })
        .click();
      const dialog = page.getByRole("dialog", { name: "Replies", exact: true });
      await dialog.waitFor();
      await dialog
        .getByRole("textbox", { name: "Write a reply" })
        .fill("A local design test reply.");
      await dialog.getByRole("button", { name: "Send reply" }).click();
      await dialog
        .getByText("A local design test reply.", { exact: true })
        .first()
        .waitFor();
      await waitForDocuments(
        "posts/local-cleanup/comments",
        (list) => list.length > 0,
      );
      await page.screenshot({ path: `${dir}/replies.png` });
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("dialog[open]").count(), 0);
    },
  );
  await check(
    "Profile identity, follow/unfollow and content tabs",
    async () => {
      await open("/profile?uid=local-neighbour-one");
      await page
        .getByRole("heading", { name: "Sam Rivera", exact: true })
        .waitFor();
      assert.equal(
        await page.getByText("Verified citizen", { exact: false }).count(),
        0,
      );
      const follow = page.getByRole("button", { name: "Follow", exact: true });
      if (await follow.count()) await follow.click();
      await page
        .getByRole("button", { name: "Following", exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByRole("button", { name: "Following", exact: true })
        .waitFor();
      await page
        .getByRole("button", { name: "Following", exact: true })
        .click();
      await page.getByRole("button", { name: "Follow", exact: true }).waitFor();
      await page.getByRole("button", { name: "Media", exact: true }).click();
      await page.locator(".hv-profile-tile").first().waitFor();
    },
  );
  await check(
    "Direct messages: actual send and persisted conversation",
    async () => {
      await open("/chats");
      await page
        .getByRole("button", { name: /Sam Rivera/ })
        .first()
        .click();
      const input = page.getByPlaceholder(/^Message Sam Rivera/);
      await input.fill("Hello from the isolated design test.");
      await input.press("Enter");
      await page
        .getByText("Hello from the isolated design test.", { exact: true })
        .first()
        .waitFor();
      await waitForDocuments("chats/local-chat/messages", (list) =>
        list.some(
          (x) =>
            x.fields.text?.stringValue ===
            "Hello from the isolated design test.",
        ),
      );
      await page.screenshot({ path: `${dir}/messages.png` });
    },
  );
  await check("Notifications mark-read persistence", async () => {
    await open("/notifications");
    await page
      .getByRole("button", { name: "Mark all read", exact: true })
      .click();
    await page.waitForTimeout(300);
    const notification = await (
      await fetch(
        `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/notifications/local-notification`,
      )
    ).json();
    assert.equal(notification.fields.read.booleanValue, true);
  });
  await check("Volunteer group membership and community routes", async () => {
    await open("/volunteer-group/local-group");
    const join = page.getByRole("button", { name: "Join group", exact: true });
    if (await join.count()) await join.click();
    await page
      .getByRole("button", { name: "Leave group", exact: true })
      .waitFor();
    assert.ok(
      (await documents("volunteerGroupMembers")).some(
        (x) =>
          x.fields.uid?.stringValue === uid &&
          x.fields.groupId?.stringValue === "local-group",
      ),
    );
    for (const label of ["Issues", "Activities", "Discussion", "Members"]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page.waitForTimeout(150);
    }
    await open("/issue-community/issue_local-cleanup");
    await page
      .getByRole("heading", { name: "A cleaner shared green", exact: true })
      .waitFor();
    await page.getByRole("link", { name: /Community info/i }).click();
    await page.waitForURL(/\/details$/);
  });
  await check("Create choices and report steps", async () => {
    await open("/");
    await page
      .getByRole("button", { name: "Create", exact: true })
      .filter({ visible: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Start something local." });
    await dialog.waitFor();
    await dialog.getByRole("button", { name: /Photo Report/ }).click();
    await page.waitForURL(origin + "/create");
    await page
      .getByRole("heading", { name: "What are you reporting?", exact: true })
      .first()
      .waitFor();
    await page.screenshot({
      path: `${dir}/report-category.png`,
      fullPage: true,
    });
    await open("/");
    await open("/create");
    await page.getByRole("heading", { name: /What’s happening/ }).waitFor();
    await page.getByRole("button", { name: /Start a conversation/ }).click();
    await page.locator("textarea").first().waitFor();
    await page.locator("textarea").first().fill("Local design test draft.");
    await page.screenshot({ path: `${dir}/text-draft.png`, fullPage: true });
  });
  await check(
    "Mobile navigation, modal focus, Updates and viewport",
    async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open("/");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Navigation", exact: true })
        .waitFor();
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator(":focus").getAttribute("aria-label"),
        "Open navigation",
      );
      await page
        .getByRole("button", { name: "Open community updates", exact: true })
        .filter({ visible: true })
        .click();
      await page
        .locator("#community-updates-drawer")
        .waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      assert.equal(
        await page.locator("#community-updates-drawer").isVisible(),
        false,
      );
      await page.screenshot({ path: `${dir}/mobile-feed.png`, fullPage: true });
    },
  );
  assert.deepEqual(evidence.errors, []);
  assert.deepEqual(
    evidence.console.filter((m) => m.type === "error"),
    [],
  );
} catch (error) {
  results.push({ status: "failed", message: error.message });
  await page.screenshot({ path: `${dir}/failure.png`, fullPage: true });
  throw error;
} finally {
  await fs.writeFile(
    `${dir}/${process.argv[2] ? "results-continued" : "results"}.json`,
    JSON.stringify({ results, evidence }, null, 2),
  );
  await browser.close();
}
