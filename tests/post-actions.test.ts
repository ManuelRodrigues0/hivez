import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  batch: { set: vi.fn(), commit: vi.fn() },
  notification: vi.fn(),
  engagement: vi.fn(),
  canAccess: vi.fn(),
  canReceive: vi.fn(),
  canMessage: vi.fn(),
  generatedId: 0,
}));

vi.mock("../src/firebase/firebase", () => ({ db: { mocked: true } }));
vi.mock("firebase/firestore", () => ({
  collection: (_db: unknown, ...parts: string[]) => parts.join("/"),
  doc: (_dbOrCollection: unknown, ...parts: string[]) =>
    parts.length ? parts.join("/") : `generated-message-${++mocks.generatedId}`,
  increment: (value: number) => ({ increment: value }),
  serverTimestamp: () => ({ serverTimestamp: true }),
  runTransaction: mocks.transaction,
  writeBatch: () => mocks.batch,
}));
vi.mock("../src/services/notifications", () => ({
  createNotification: mocks.notification,
}));
vi.mock("../src/services/engagementEvents", () => ({
  recordPostEngagement: mocks.engagement,
}));
vi.mock("../src/services/privacy", () => ({
  canUserAccessPost: mocks.canAccess,
  canReceiveSharedPost: mocks.canReceive,
  canMessageUser: mocks.canMessage,
}));

import { toggleReHive } from "../src/services/rehives";
import { toggleSavePost } from "../src/services/savedPosts";
import { sendPostViaDm } from "../src/services/dmSharing";

const post = {
  id: "issue-1",
  uid: "author-1",
  caption: "A fallen branch is blocking the path.",
  category: "roads",
  likes: 2,
  comments: 0,
  reHives: 0,
} as never;
const actor = {
  uid: "neighbour-1",
  username: "neighbour",
  displayName: "Local Neighbour",
  photoURL: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.generatedId = 0;
  mocks.batch.set.mockReset();
  mocks.batch.commit.mockReset().mockResolvedValue(undefined);
  mocks.canAccess.mockResolvedValue(true);
  mocks.canReceive.mockResolvedValue(true);
  mocks.canMessage.mockResolvedValue(true);
  mocks.notification.mockResolvedValue(undefined);
  mocks.engagement.mockResolvedValue(undefined);
  mocks.transaction.mockImplementation(async (_db, update) => {
    const exists = new Set<string>();
    const tx = {
      get: async (ref: string) => ({
        exists: () => ref === "posts/issue-1" || exists.has(ref),
        data: () => ({ uid: "author-1" }),
      }),
      set: (ref: string) => exists.add(ref),
      delete: (ref: string) => exists.delete(ref),
      update: vi.fn(),
    };
    return update(tx);
  });
});

describe("post action persistence", () => {
  it("toggles ReHive atomically and treats notification failures as non-blocking", async () => {
    mocks.notification.mockRejectedValueOnce(new Error("notification unavailable"));

    await expect(toggleReHive({ userId: actor.uid, actor, post })).resolves.toEqual({ active: true });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.engagement).toHaveBeenCalledWith(expect.objectContaining({ type: "rehive" }));
  });

  it("saves a post even if its optional engagement record fails", async () => {
    mocks.engagement.mockRejectedValueOnce(new Error("analytics unavailable"));

    await expect(toggleSavePost({ userId: actor.uid, post })).resolves.toEqual({ saved: true });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("writes the chat preview and shared post together, then tolerates notification failures", async () => {
    mocks.notification.mockRejectedValueOnce(new Error("notification unavailable"));

    await expect(sendPostViaDm({
      post,
      sender: actor,
      recipient: { uid: "friend-1", username: "friend", displayName: "Friend", photoURL: "" },
      optionalText: "Can you help?",
    })).resolves.toBe("friend-1_neighbour-1");

    expect(mocks.batch.set).toHaveBeenCalledTimes(2);
    expect(mocks.batch.set.mock.calls[0][1]).toMatchObject({
      participants: [actor.uid, "friend-1"],
      lastMessage: "Shared a post: Can you help?",
      unreadCounts: { "friend-1": { increment: 1 }, [actor.uid]: 0 },
    });
    expect(mocks.batch.set.mock.calls[1][1]).toMatchObject({
      messageType: "POST_SHARE",
      postId: post.id,
      text: "Can you help?",
      senderId: actor.uid,
    });
    expect(mocks.batch.commit).toHaveBeenCalledTimes(1);
  });

  it("does not report a DM as sent when the atomic write fails", async () => {
    mocks.batch.commit.mockRejectedValueOnce(new Error("offline"));

    await expect(sendPostViaDm({
      post,
      sender: actor,
      recipient: { uid: "friend-1", username: "friend", displayName: "Friend", photoURL: "" },
    })).rejects.toThrow("offline");
    expect(mocks.notification).not.toHaveBeenCalled();
    expect(mocks.engagement).not.toHaveBeenCalled();
  });

  it("blocks DM sharing when the recipient cannot view the post", async () => {
    mocks.canReceive.mockResolvedValueOnce(false);

    await expect(sendPostViaDm({
      post,
      sender: actor,
      recipient: { uid: "friend-1", username: "friend", displayName: "Friend", photoURL: "" },
    })).rejects.toThrow("cannot view this post");
    expect(mocks.batch.commit).not.toHaveBeenCalled();
  });
});
