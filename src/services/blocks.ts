import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";
import type { TimestampLike } from "@/types/timestamp";

export interface BlockDoc {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt?: TimestampLike | null;
}

/** Deterministic, direction-independent id so a block is one document. */
export function blockIdFor(a: string, b: string) {
  return [a, b].sort().join("_");
}

/** True when either direction of the pair has a block document. */
export async function isBlockedBetween(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b || a === b) return false;
  const snap = await getDoc(doc(db, "blocks", blockIdFor(a, b)));
  return snap.exists();
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new Error("You cannot block yourself.");
  await setDoc(doc(db, "blocks", blockIdFor(blockerId, blockedId)), {
    blockerId,
    blockedId,
    createdAt: serverTimestamp(),
  });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await deleteDoc(doc(db, "blocks", blockIdFor(blockerId, blockedId)));
}

/** Realtime blocked state between two users (either direction). */
export function listenToBlockState(
  uid: string | null | undefined,
  otherId: string | null | undefined,
  onNext: (blocked: boolean) => void
) {
  if (!uid || !otherId || uid === otherId) {
    onNext(false);
    return () => {};
  }
  return onSnapshot(doc(db, "blocks", blockIdFor(uid, otherId)), (snap) => onNext(snap.exists()));
}

/** Live list of user ids the given user has blocked (their own block list). */
export function listenToBlocksBy(
  blockerId: string,
  onNext: (blockedIds: string[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(collection(db, "blocks"), where("blockerId", "==", blockerId));
  return onSnapshot(
    q,
    (snapshot) => {
      onNext(snapshot.docs.map((d) => (d.data() as BlockDoc).blockedId));
    },
    onError
  );
}