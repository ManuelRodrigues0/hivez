import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
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
  if (input.parentId) {
    const parentSnap = await getDoc(doc(db, "posts", input.post.id, "comments", input.parentId));
    const parent = parentSnap.data() as CommentDoc | undefined;
    if (parentSnap.exists() && parent) {
      depth = Math.min((parent.depth ?? 0) + 1, 6);
      parentAuthorId = parent.uid;
    }
  }

  batch.set(commentRef, {
    uid: input.actor.uid,
    username: input.actor.username || "",
    displayName: input.actor.displayName || input.actor.username || "Hivez User",
    photoURL: input.actor.photoURL || "",
    text,
    parentId: input.parentId || null,
    depth,
    mentionedUserIds: mentions.map((mention) => mention.uid),
    mentions,
    likes: 0,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "posts", input.post.id), { comments: increment(1) });
  await batch.commit();

  await recordPostEngagement({
    postId: input.post.id,
    actorId: input.actor.uid,
    authorId: input.post.uid,
    type: "comment",
    category: input.post.category,
  });

  const recipients = new Set([input.post.uid, ...mentions.map((mention) => mention.uid)]);
  if (parentAuthorId) recipients.add(parentAuthorId);
  await Promise.all(
    [...recipients].map((recipientId) =>
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
  );

  return commentRef.id;
}

export function listenToCommentLikeState(
  userId: string | null | undefined,
  postId: string,
  commentId: string,
  onNext: (liked: boolean) => void
) {
  if (!userId) {
    onNext(false);
    return () => {};
  }
  return onSnapshot(doc(db, "posts", postId, "comments", commentId, "likes", userId), (snap) => onNext(snap.exists()));
}

export async function toggleCommentLike(postId: string, commentId: string, userId: string) {
  const commentRef = doc(db, "posts", postId, "comments", commentId);
  const likeRef = doc(db, "posts", postId, "comments", commentId, "likes", userId);
  await runTransaction(db, async (tx) => {
    const likeSnap = await tx.get(likeRef);
    if (likeSnap.exists()) {
      tx.delete(likeRef);
      tx.update(commentRef, { likes: increment(-1) });
    } else {
      tx.set(likeRef, { userId, createdAt: serverTimestamp() });
      tx.update(commentRef, { likes: increment(1) });
    }
  });
}

export async function deleteComment(postId: string, commentId: string) {
  await deleteDoc(doc(db, "posts", postId, "comments", commentId));
  await updateDoc(doc(db, "posts", postId), { comments: increment(-1) });
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
