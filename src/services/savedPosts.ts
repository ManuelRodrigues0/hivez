import {
  collection,
  doc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";
import type { FeedPost } from "@/components/feed/Feed";
import { recordPostEngagement } from "@/services/engagementEvents";
import type { TimestampLike } from "@/types/timestamp";

export interface SavedPostDoc {
  id: string;
  userId: string;
  postId: string;
  postAuthorId: string;
  createdAt?: TimestampLike | null;
}

export function savedPostIdFor(userId: string, postId: string) {
  return `${userId}_${postId}`;
}

/**
 * Realtime saved state for a single post + viewer. Backed by
 * `savedPosts/{userId}_{postId}` so it is private to the owner and survives
 * refresh.
 */
export function listenToSavedPostState(
  userId: string | null | undefined,
  postId: string,
  onNext: (saved: boolean) => void
) {
  if (!userId) {
    onNext(false);
    return () => {};
  }
  return onSnapshot(doc(db, "savedPosts", savedPostIdFor(userId, postId)), (snap) => onNext(snap.exists()));
}

/**
 * Atomic save/unsave. Uses a deterministic document id so double-clicks and
 * multiple sessions can never produce duplicate saved records, and keeps the
 * post's public `saves` counter accurate via a Firestore transaction.
 */
export async function toggleSavePost(input: { userId: string; post: FeedPost }) {
  const postRef = doc(db, "posts", input.post.id);
  const saveRef = doc(db, "savedPosts", savedPostIdFor(input.userId, input.post.id));
  let saved = false;
  let postAuthorId = input.post.uid;

  await runTransaction(db, async (tx) => {
    const [postSnap, saveSnap] = await Promise.all([tx.get(postRef), tx.get(saveRef)]);
    if (!postSnap.exists()) throw new Error("This post is unavailable.");
    const postData = postSnap.data() as FeedPost;
    postAuthorId = postData.uid;

    if (saveSnap.exists()) {
      tx.delete(saveRef);
      tx.update(postRef, { saves: increment(-1) });
      saved = false;
      return;
    }

    tx.set(saveRef, {
      userId: input.userId,
      postId: input.post.id,
      postAuthorId,
      createdAt: serverTimestamp(),
    });
    tx.update(postRef, { saves: increment(1) });
    saved = true;
  });

  if (saved) {
    await recordPostEngagement({
      postId: input.post.id,
      actorId: input.userId,
      authorId: postAuthorId,
      type: "save",
      category: input.post.category,
    });
  }

  return { saved };
}

/** Live list of the signed-in user's saved records, newest first (real Firestore data). */
export function listenToUserSavedPosts(
  userId: string,
  onNext: (records: SavedPostDoc[]) => void,
  onError?: (error: Error) => void,
  maxResults = 60
) {
  const q = query(
    collection(db, "savedPosts"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(maxResults)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onNext(
        snapshot.docs.map((record) => ({
          id: record.id,
          ...(record.data() as Omit<SavedPostDoc, "id">),
        }))
      );
    },
    onError
  );
}