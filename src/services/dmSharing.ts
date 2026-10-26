import {
  collection,
  doc,
  increment,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";
import type { FeedPost } from "@/components/feed/Feed";
import { createNotification, type NotificationActor } from "@/services/notifications";
import { canMessageUser, canReceiveSharedPost, canUserAccessPost } from "@/services/privacy";
import { recordPostEngagement } from "@/services/engagementEvents";

export type MessageType = "TEXT" | "POST_SHARE";

export function chatIdForUsers(a: string, b: string) {
  return [a, b].sort().join("_");
}

export async function sendPostViaDm(input: {
  post: FeedPost;
  sender: NotificationActor;
  recipient: NotificationActor;
  optionalText?: string;
}) {
  const [senderCanView, recipientCanView, canMessage] = await Promise.all([
    canUserAccessPost(input.sender.uid, input.post),
    canReceiveSharedPost(input.recipient.uid, input.post),
    canMessageUser(input.sender.uid, input.recipient.uid),
  ]);

  if (!senderCanView) throw new Error("This post is unavailable.");
  if (!recipientCanView) throw new Error(`${input.recipient.displayName || input.recipient.username} cannot view this post.`);
  if (!canMessage) throw new Error(`${input.recipient.displayName || input.recipient.username} is not accepting messages from you.`);

  const chatId = chatIdForUsers(input.sender.uid, input.recipient.uid);
  const chatRef = doc(db, "chats", chatId);
  // Existing message rules require the parent chat to exist before its first
  // message is written. Create it once without a misleading message preview.
  await runTransaction(db, async tx => {
    if ((await tx.get(chatRef)).exists()) return;
    tx.set(chatRef, {
      participants: [input.sender.uid, input.recipient.uid],
      participantProfiles: {
        [input.sender.uid]: input.sender,
        [input.recipient.uid]: input.recipient,
      },
      createdAt: serverTimestamp(),
      unreadCounts: { [input.sender.uid]: 0, [input.recipient.uid]: 0 },
    });
  });
  const text = input.optionalText?.trim() || "";
  const lastMessage = text ? `Shared a post: ${text}` : "Shared a post";

  const batch = writeBatch(db);
  batch.set(chatRef, {
    participants: [input.sender.uid, input.recipient.uid],
    participantProfiles: {
      [input.sender.uid]: input.sender,
      [input.recipient.uid]: input.recipient,
    },
    lastMessage,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: input.sender.uid,
    unreadCounts: {
      [input.recipient.uid]: increment(1),
      [input.sender.uid]: 0,
    },
  }, { merge: true });

  const messageRef = doc(collection(db, "chats", chatId, "messages"));
  batch.set(messageRef, {
    messageType: "POST_SHARE",
    text,
    postId: input.post.id,
    postAuthorId: input.post.uid,
    senderId: input.sender.uid,
    createdAt: serverTimestamp(),
    readBy: [input.sender.uid],
    reactions: {},
  });

  // Keep the chat preview and message in one commit. A failed write cannot
  // leave a preview that points to a message that was never sent.
  await batch.commit();

  const sideEffects = await Promise.allSettled([
    createNotification({
      recipientId: input.recipient.uid,
      actor: input.sender,
      type: "message",
      text: lastMessage,
      link: "/chats",
      chatId,
      postId: input.post.id,
    }),
    recordPostEngagement({
      postId: input.post.id,
      actorId: input.sender.uid,
      authorId: input.post.uid,
      type: "share",
      category: input.post.category,
    }),
  ]);
  if (sideEffects.some((result) => result.status === "rejected")) {
    console.warn("Post message was sent, but a notification or engagement event could not be recorded.");
  }

  return chatId;
}
