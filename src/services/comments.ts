import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";
import type { FeedPost } from "@/components/feed/Feed";
import { createNotification, type NotificationActor } from "@/services/notifications";
import { canCommentOnPost, canMentionUser } from "@/services/privacy";
import { recordPostEngagement } from "@/services/engagementEvents";
import type { TimestampLike } from "@/types/timestamp";

export interface MentionRef {
  uid: string;
  username: string;
  displayName?: string;
}

export interface CommentDoc {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  text: string;
  /** Replies attach to their parent comment id; null on top-level comments. */
  parentId?: string | null;
  /** Thread depth for visual nesting (derived from the parent on write). */
  depth?: number;
  mentionedUserIds?: string[];
  mentions?: MentionRef[];
  likes?: number;
  createdAt?: TimestampLike | null;
}

export function extractMentionHandles(text: string) {
  const handles = text.match(/(^|\s)@([a-z0-9_]{3,24})/gi) || [];
  return [...new Set(handles.map((handle) => handle.trim().replace(/^@/, "").toLowerCase()))];
}

export function getActiveMentionQuery(text: string) {
  const match = text.match(/(?:^|\s)@([a-z0-9_]{1,24})$/i);
  return match?.[1]?.toLowerCase() || "";
}

export async function resolveMentions(text: string, actorId: string) {
  const handles = extractMentionHandles(text).slice(0, 8);
  const mentions: MentionRef[] = [];

  await Promise.all(
    handles.map(async (username) => {
      const usernameSnap = await getDoc(doc(db, "usernames", username));
      if (!usernameSnap.exists()) return;
      const uid = usernameSnap.data()?.uid;
      if (!uid || !(await canMentionUser(actorId, uid))) return;
      const profileSnap = await getDoc(doc(db, "users", uid));
      const profile = profileSnap.data();
      mentions.push({
        uid,
        username,
        displayName: profile?.displayName || profile?.username || username,
      });
    })
  );

  return mentions;
}

export function listenToPostComments(postId: string, onNext: (comments: CommentDoc[]) => void, onError?: (error: Error) => void) {
  const q = query(collection(db, "posts", postId, "comments"), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      onNext(
        snapshot.docs.map((commentDoc) => ({
          id: commentDoc.id,
          ...(commentDoc.data() as Omit<CommentDoc, "id">),
        }))
      );
    },
    onError
  );
}

export async function addPostComment(input: {
  post: FeedPost;
  actor: NotificationActor;
  text: string;
  /** Set when replying to an existing comment; otherwise null for top-level. */
  parentId?: string | null;
}) {
  const text = input.text.trim();
  if (!text) return null;

  if (!(await canCommentOnPost(input.actor.uid, input.post))) {
    throw new Error("This author limits who can comment.");
  }

  const mentions = await resolveMentions(text, input.actor.uid);
  const commentRef = doc(collection(db, "posts", input.post.id, "comments"));
  const batch = writeBatch(db);

  // Reply threading: attach to the parent comment and inherit its depth.
  let parentAuthorId: string | null = null;
  let depth = 0;
  let parentId: string | null = null;
  if (input.parentId) {
    const parentSnap = await getDoc(doc(db, "posts", input.post.id, "comments", input.parentId));
    const parent = parentSnap.data() as CommentDoc | undefined;
    if (parentSnap.exists() && parent) {
      depth = Math.min((parent.depth ?? 0) + 1, 6);
      parentAuthorId = parent.uid;
      parentId = parentSnap.id;
    }
  }

  batch.set(commentRef, {
    uid: input.actor.uid,
    username: input.actor.username || "",
    displayName: input.actor.displayName || input.actor.username || "Hivez User",
    photoURL: input.actor.photoURL || "",
    text,
    parentId,
    depth,
    mentionedUserIds: mentions.map((mention) => mention.uid),
    mentions,
    likes: 0,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "posts", input.post.id), { comments: increment(1) });
  await batch.commit();

  const recipients = new Set([input.post.uid, ...mentions.map((mention) => mention.uid)]);
  if (parentAuthorId) recipients.add(parentAuthorId);
  recipients.delete(input.actor.uid);
  const sideEffects = await Promise.allSettled([
    recordPostEngagement({
      postId: input.post.id,
      actorId: input.actor.uid,
      authorId: input.post.uid,
      type: "comment",
      category: input.post.category,
    }),
    ...[...recipients].map((recipientId) =>
      createNotification({
        recipientId,
        actor: input.actor,
        type: recipientId === input.post.uid || recipientId === parentAuthorId ? "comment" : "mention",
        text,
        link: `/post/${input.post.id}`,
        postId: input.post.id,
        commentId: commentRef.id,
      })
    )
  ]);
  if (sideEffects.some((result) => result.status === "rejected")) {
    console.warn("Comment was posted, but a notification or engagement event could not be recorded.");
  }

  return commentRef.id;
}

export function listenToCommentLikeState(
  userId: string | null | undefined,
  postId: string,
  commentId: string,
  onNext: (liked: boolean) => void,
  onCount?: (count: number) => void,
) {
  if (!userId) {
    onNext(false);
    return () => {};
  }
  // Like documents are the source of truth. Other people cannot update the
  // author's comment document under the existing rules, including its counter.
  return onSnapshot(collection(db, "posts", postId, "comments", commentId, "likes"), snapshot => {
    onNext(snapshot.docs.some(record => record.id === userId));
    onCount?.(snapshot.size);
  });
}

export async function toggleCommentLike(postId: string, commentId: string, userId: string) {
  const commentRef = doc(db, "posts", postId, "comments", commentId);
  const likeRef = doc(db, "posts", postId, "comments", commentId, "likes", userId);
  await runTransaction(db, async (tx) => {
    const [commentSnap, likeSnap] = await Promise.all([tx.get(commentRef), tx.get(likeRef)]);
    if (!commentSnap.exists()) throw new Error("This comment is unavailable.");
    if (likeSnap.exists()) {
      tx.delete(likeRef);
    } else {
      tx.set(likeRef, { userId, createdAt: serverTimestamp() });
    }
  });
}

export async function deleteComment(postId: string, commentId: string) {
  const commentRef = doc(db, "posts", postId, "comments", commentId);
  await runTransaction(db, async tx => {
    if (!(await tx.get(commentRef)).exists()) return;
    tx.delete(commentRef);
    tx.update(doc(db, "posts", postId), { comments: increment(-1) });
  });
}

export async function reportComment(input: { postId: string; commentId: string; reporterId: string; reason?: string }) {
  await addDoc(collection(db, "reports"), {
    type: "comment",
    postId: input.postId,
    commentId: input.commentId,
    reporterId: input.reporterId,
    reason: input.reason || "Comment report",
    status: "pending",
    createdAt: serverTimestamp(),
  });
}
