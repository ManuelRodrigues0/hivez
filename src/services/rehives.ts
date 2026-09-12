import {
  collection,
  doc,
  documentId,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";
import type { FeedPost } from "@/components/feed/Feed";
import { createNotification, type NotificationActor } from "@/services/notifications";
import { canUserAccessPost } from "@/services/privacy";
import { recordPostEngagement } from "@/services/engagementEvents";
import type { TimestampLike } from "@/types/timestamp";

export interface ReHiveDoc {
  id: string;
  userId: string;
  postId: string;
  postAuthorId: string;
  createdAt?: TimestampLike | null;
}

export function reHiveIdFor(userId: string, postId: string) {
  return `${userId}_${postId}`;
}

export function listenToReHiveState(userId: string | null | undefined, postId: string, onNext: (active: boolean) => void) {
  if (!userId) {
    onNext(false);
    return () => {};
  }
  return onSnapshot(doc(db, "reHives", reHiveIdFor(userId, postId)), (snap) => onNext(snap.exists()));
}

export async function toggleReHive(input: {
  userId: string;
  actor: NotificationActor;
  post: FeedPost;
}) {
  const canAccess = await canUserAccessPost(input.userId, input.post);
  if (!canAccess) throw new Error("This post is unavailable.");

  const postRef = doc(db, "posts", input.post.id);
  const reHiveRef = doc(db, "reHives", reHiveIdFor(input.userId, input.post.id));
  let active = false;
  let postAuthorId = input.post.uid;

  await runTransaction(db, async (tx) => {
    const [postSnap, reHiveSnap] = await Promise.all([tx.get(postRef), tx.get(reHiveRef)]);
    if (!postSnap.exists()) throw new Error("This post is unavailable.");
    const postData = postSnap.data() as FeedPost;
    postAuthorId = postData.uid;

    if (reHiveSnap.exists()) {
      tx.delete(reHiveRef);
      tx.update(postRef, { reHives: increment(-1) });
      active = false;
      return;
    }

    tx.set(reHiveRef, {
      userId: input.userId,
      postId: input.post.id,
      postAuthorId,
      createdAt: serverTimestamp(),
    });
    tx.update(postRef, { reHives: increment(1) });
    active = true;
  });

  if (active) {
    await Promise.all([
      createNotification({
        recipientId: postAuthorId,
        actor: input.actor,
        type: "rehive",
        text: input.post.caption || "your post",
        link: `/post/${input.post.id}`,
        postId: input.post.id,
      }),
      recordPostEngagement({
        postId: input.post.id,
        actorId: input.userId,
        authorId: postAuthorId,
        type: "rehive",
        category: input.post.category,
      }),
    ]);
  }

  return { active };
}

export function listenToUserReHives(
  userId: string,
  onNext: (records: ReHiveDoc[]) => void,
  onError?: (error: Error) => void,
  maxResults = 36
) {
  const q = query(collection(db, "reHives"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(maxResults));
  return onSnapshot(
    q,
    (snapshot) => {
      onNext(
        snapshot.docs.map((record) => ({
          id: record.id,
          ...(record.data() as Omit<ReHiveDoc, "id">),
        }))
      );
    },
    onError
  );
}

export function listenToPostsByIds(postIds: string[], onNext: (posts: FeedPost[]) => void, onError?: (error: Error) => void) {
  const ids = [...new Set(postIds)].filter(Boolean);
  if (!ids.length) {
    onNext([]);
    return () => {};
  }

  const postMap = new Map<string, FeedPost>();
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += 10) {
    chunks.push(ids.slice(index, index + 10));
  }

  const notify = () => {
    onNext(ids.map((id) => postMap.get(id)).filter(Boolean) as FeedPost[]);
  };

  const unsubs: Unsubscribe[] = chunks.map((chunk) => {
    const q = query(collection(db, "posts"), where(documentId(), "in", chunk));
    return onSnapshot(
      q,
      (snapshot) => {
        chunk.forEach((id) => postMap.delete(id));
        snapshot.docs.forEach((postDoc) => {
          postMap.set(postDoc.id, { id: postDoc.id, ...(postDoc.data() as Omit<FeedPost, "id">) });
        });
        notify();
      },
      onError
    );
  });

  return () => unsubs.forEach((unsubscribe) => unsubscribe());
}

export async function getReHivedPost(postId: string) {
  const snap = await getDoc(doc(db, "posts", postId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<FeedPost, "id">) } as FeedPost) : null;
}
