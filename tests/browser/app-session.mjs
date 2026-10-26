// Actual app and Firebase clients; only endpoints are redirected to local demo emulators.
import fs from "node:fs/promises";
const { chromium } = await import(
  process.env.HIVEZ_PLAYWRIGHT_MODULE || "playwright"
);
export const origin = process.env.HIVEZ_TEST_ORIGIN || "http://localhost:5173";
export const project = "demo-hivez-design";
export const output = process.env.HIVEZ_TEST_OUTPUT || "artifacts/app-redesign";
const email = "design-test@example.invalid";
const password = "Local-Design-Only-2026!";
export async function saveDoc(path, data) {
  function field(value) {
    if (value === null) return { nullValue: null };
    if (value instanceof Date) return { timestampValue: value.toISOString() };
    if (typeof value === "string") return { stringValue: value };
    if (typeof value === "boolean") return { booleanValue: value };
    if (typeof value === "number")
      return Number.isInteger(value)
        ? { integerValue: String(value) }
        : { doubleValue: value };
    if (Array.isArray(value))
      return { arrayValue: { values: value.map(field) } };
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, field(v)]),
        ),
      },
    };
  }
  const response = await fetch(
    `http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/${path}`,
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, field(v)]),
        ),
      }),
    },
  );
  if (!response.ok) throw new Error(await response.text());
}
export async function seedDesignData() {
  let account;
  for (const action of ["signUp", "signInWithPassword"]) {
    const response = await fetch(
      `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:${action}?key=demo-key`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      },
    );
    account = await response.json();
    if (account.localId) break;
  }
  if (!account.localId) throw new Error(JSON.stringify(account));
  const uid = account.localId;
  const privacy = {
    account: "public",
    messages: "everyone",
    mentions: "everyone",
    comments: "everyone",
    discoverable: true,
  };
  const profiles = [
    {
      uid,
      displayName: "Alex Morgan",
      username: "alexlocal",
      photoURL: "/avatars/1958311d-8559-4a64-9203-dc3fb355a8d6.jpg",
      bio: "Local emulator test profile. Small steps for a better neighbourhood.",
    },
    {
      uid: "local-neighbour-one",
      displayName: "Sam Rivera",
      username: "samrivera",
      photoURL: "/avatars/319cd5c2-5426-45ff-a2c8-700d41b25e97.jpg",
      bio: "Synthetic local test neighbour. Here to lend a hand.",
    },
    {
      uid: "local-neighbour-two",
      displayName: "Jamie Chen",
      username: "jamiechen",
      photoURL: "/avatars/569bdb7b-c5d4-4db9-a086-3825c01a10a9.jpg",
      bio: "Synthetic local test neighbour.",
    },
  ];
  for (const p of profiles)
    await saveDoc(`users/${p.uid}`, {
      ...p,
      displayNameLower: p.displayName.toLowerCase(),
      usernameLower: p.username,
      profileCompleted: true,
      privacy,
      accountPrivacy: "public",
      isPrivate: false,
      verified: false,
      posts: 1,
      followers: 0,
      following: 0,
      isAdmin: p.uid === uid,
      createdAt: new Date("2026-01-01"),
    });
  const posts = [
    {
      id: "local-cleanup",
      p: profiles[1],
      caption:
        "A little care goes a long way. We spent the morning clearing litter from the shared green. Anyone up for doing it again next weekend?\n\nLocal test post — illustrative photography.",
      category: "waste",
      mediaUrl: "/auth/people-together.jpg",
      mediaType: "image",
      likes: 6,
      comments: 0,
    },
    {
      id: "local-street",
      p: profiles[2],
      caption:
        "Good neighbourhoods start with a conversation. What is one thing you would change on your street?\n\nLocal emulator test content.",
      category: "roads",
      mediaUrl: "",
      mediaType: "text",
      likes: 3,
      comments: 0,
    },
    {
      id: "local-help",
      p: profiles[0],
      caption:
        "A small hello from your corner of Hivez. Sharing ideas, finding common ground, and making things a little better together.\n\nLocal emulator test content.",
      category: "street-lights",
      mediaUrl: "",
      mediaType: "text",
      likes: 1,
      comments: 0,
    },
  ];
  for (const [i, post] of posts.entries()) {
    const { p, id, ...data } = post;
    await saveDoc(`posts/${id}`, {
      ...data,
      uid: p.uid,
      displayName: p.displayName,
      username: p.username,
      photoURL: p.photoURL,
      verified: false,
      shares: 0,
      saves: 0,
      reHives: 0,
      visibility: "public",
      sensitive: false,
      hashtags: ["community"],
      createdAt: new Date(Date.now() - i * 3600000),
      location: "Mumbai",
      locationSnapshot: {
        latitude: 19.076,
        longitude: 72.8777,
        geohash: "10908_25288",
        city: "Mumbai",
        label: "Mumbai",
      },
    });
  }
  const owner = profiles[1];
  const now = new Date();
  await saveDoc("issueCommunities/issue_local-cleanup", {
    postId: "local-cleanup",
    issueId: "local-cleanup",
    title: "A cleaner shared green",
    description:
      "Local emulator test community. Neighbours coordinating a small cleanup.",
    category: "waste",
    location: "Mumbai",
    ownerId: owner.uid,
    owner,
    status: "REPORTED",
    memberCount: 1,
    activityCount: 1,
    rules: ["Be considerate.", "Keep conversations constructive."],
    archived: false,
    mediaUrl: "/auth/people-together.jpg",
    mediaType: "image",
    createdAt: now,
    updatedAt: now,
  });
  await saveDoc(`communityMembers/issue_local-cleanup_${owner.uid}`, {
    communityId: "issue_local-cleanup",
    uid: owner.uid,
    role: "owner",
    user: owner,
    joinedAt: now,
  });
  await saveDoc("volunteerGroups/local-group", {
    name: "Neighbourhood hands",
    description: "Local emulator test group for shared community action.",
    location: "Mumbai",
    ownerId: owner.uid,
    owner,
    memberCount: 1,
    organizers: [],
    issueIds: ["local-cleanup"],
    createdAt: now,
    updatedAt: now,
  });
  await saveDoc(`volunteerGroupMembers/local-group_${owner.uid}`, {
    groupId: "local-group",
    uid: owner.uid,
    role: "owner",
    user: owner,
    joinedAt: now,
  });
  await saveDoc("volunteerActivities/local-action", {
    communityId: "issue_local-cleanup",
    issueId: "local-cleanup",
    groupId: "local-group",
    title: "A little care for our shared green",
    description: "Local emulator test activity, not a real scheduled event.",
    category: "waste",
    organizerId: owner.uid,
    organizer: owner,
    location: "Mumbai",
    meetingPoint: "Shared green — test location",
    startDate: "2026-10-26",
    startTime: "09:00",
    endDate: "2026-10-26",
    endTime: "11:00",
    volunteerLimit: 10,
    volunteerCount: 0,
    status: "OPEN",
    urgent: false,
    roles: ["Volunteer"],
    requirements: "Bring your ideas.",
    instructions: "Local test only.",
    verificationMethod: "community",
    evidenceRequirements: "",
    actionType: "cleanup",
    progressState: "NOT_STARTED",
    tasks: [],
    createdAt: now,
    updatedAt: now,
  });
  await saveDoc("notifications/local-notification", {
    recipientId: uid,
    actorId: owner.uid,
    actorUsername: owner.username,
    actorDisplayName: owner.displayName,
    actorPhotoURL: owner.photoURL,
    type: "comment",
    text: "Local emulator test notification.",
    link: "/post/local-cleanup",
    postId: "local-cleanup",
    read: false,
    createdAt: now,
  });
  await saveDoc("chats/local-chat", {
    participants: [uid, owner.uid],
    participantProfiles: { [uid]: profiles[0], [owner.uid]: owner },
    lastMessage: "Good things happen together. Local test conversation.",
    lastMessageAt: now,
    lastMessageSenderId: owner.uid,
    unreadCounts: { [uid]: 1 },
  });
  await saveDoc("chats/local-chat/messages/local-message", {
    senderId: owner.uid,
    text: "Good things happen together. Local emulator conversation.",
    messageType: "TEXT",
    createdAt: now,
    readBy: [owner.uid],
  });
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(
    `${output}/test-data.json`,
    JSON.stringify(
      {
        project,
        uid,
        notice: "Synthetic data in local emulators only",
        postIds: posts.map((p) => p.id),
      },
      null,
      2,
    ),
  );
  return uid;
}
export async function openAppSession({
  width = 1440,
  height = 1000,
  theme = "light",
  camera = false,
} = {}) {
  const browser = await chromium.launch({
    args: camera ? ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] : [],
    executablePath:
      process.env.HIVEZ_CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const context = await browser.newContext({
    permissions: camera ? ["camera", "microphone"] : [],
    viewport: { width, height },
    colorScheme: theme,
  });
  const evidence = { errors: [], console: [], blocked: [], failed: [] };
  await context.addInitScript((theme) => {
    localStorage.setItem("hivez-theme", theme);
    localStorage.setItem("hivez-reduced-motion", "true");
    localStorage.setItem(
      "hivez.manual-location",
      JSON.stringify({
        latitude: 19.076,
        longitude: 72.8777,
        city: "Mumbai",
        label: "Mumbai",
      }),
    );
  }, theme);
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      ![new URL(origin).host, "127.0.0.1:8080", "127.0.0.1:9099"].includes(
        url.host,
      ) &&
      !/^(?:[abc]\.)?tile\.openstreetmap\.org$/.test(url.hostname)
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
          /import\s*\{([^}]+)\}\s*from\s*(["'][^"']*firebase_auth[^"']*["'])/,
          (_, names, path) =>
            `import {${names},connectAuthEmulator} from ${path}`,
        )
        .replace(
          /import\s*\{([^}]+)\}\s*from\s*(["'][^"']*firebase_firestore[^"']*["'])/,
          (_, names, path) =>
            `import {${names},connectFirestoreEmulator} from ${path}`,
        )
        .replace(/projectId:\s*"[^"]+"/, `projectId: "${project}"`)
        .replace(/apiKey:\s*"[^"]+"/, 'apiKey: "demo-key"');
      body +=
        '\nconnectAuthEmulator(auth,"http://127.0.0.1:9099",{disableWarnings:true});\nconnectFirestoreEmulator(db,"127.0.0.1",8080);\n';
      return route.fulfill({ response, body });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => evidence.errors.push(e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type()))
      evidence.console.push({ type: m.type(), text: m.text() });
  });
  page.on("requestfailed", (r) =>
    evidence.failed.push({
      url: r.url().split("?")[0],
      reason: r.failure()?.errorText,
    }),
  );
  await page.goto(origin + "/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL(origin + "/", { timeout: 30000 });
  await page.locator(".app-shell").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1800);
  return { browser, context, page, evidence };
}
