import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";
import type { TimestampLike } from "@/types/timestamp";

export interface FollowRequest {
  id?: string;
  requesterId: string;
  targetId: string;
  status: "pending" | "accepted" | "declined";
  createdAt?: TimestampLike | null;
}

export async function createFollowRequest(requesterId: string, targetId: string) {
  const requestRef = doc(db, "followRequests", `${requesterId}_${targetId}`);
  const followRef = doc(db, "follows", `${requesterId}_${targetId}`);

  return runTransaction(db, async (tx) => {
    const [requestSnap, followSnap] = await Promise.all([tx.get(requestRef), tx.get(followRef)]);
    if (followSnap.exists()) return "following" as const;
    if (requestSnap.exists() && requestSnap.data()?.status === "pending") return "pending" as const;

    tx.set(
      requestRef,
      {
        requesterId,
        targetId,
        status: "pending",
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    return "pending" as const;
  });
}

export async function createPublicFollow(requesterId: string, targetId: string) {
  const followRef = doc(db, "follows", `${requesterId}_${targetId}`);
  const followerRef = doc(db, "users", targetId, "followers", requesterId);
  const followingRef = doc(db, "users", requesterId, "following", targetId);
  const requestRef = doc(db, "followRequests", `${requesterId}_${targetId}`);

  await runTransaction(db, async (tx) => {
    const followSnap = await tx.get(followRef);
    if (followSnap.exists()) return;

    const followData = {
      followerId: requesterId,
      followingId: targetId,
      createdAt: serverTimestamp(),
    };

    tx.set(followRef, followData);
    tx.set(followerRef, followData);
    tx.set(followingRef, followData);
    tx.update(doc(db, "users", targetId), { followers: increment(1) });
    tx.update(doc(db, "users", requesterId), { following: increment(1) });
    tx.delete(requestRef);
  });
}

export async function acceptFollowRequest(requesterId: string, targetId: string) {
  const requestRef = doc(db, "followRequests", `${requesterId}_${targetId}`);
  const followRef = doc(db, "follows", `${requesterId}_${targetId}`);
  const followerRef = doc(db, "users", targetId, "followers", requesterId);
  const followingRef = doc(db, "users", requesterId, "following", targetId);

  await runTransaction(db, async (tx) => {
    const [requestSnap, followSnap] = await Promise.all([tx.get(requestRef), tx.get(followRef)]);
    if (!requestSnap.exists()) return;

    const followData = {
      followerId: requesterId,
      followingId: targetId,
      createdAt: serverTimestamp(),
    };

    if (!followSnap.exists()) {
      tx.set(followRef, followData);
      tx.set(followerRef, followData);
      tx.set(followingRef, followData);
      tx.update(doc(db, "users", targetId), { followers: increment(1) });
      tx.update(doc(db, "users", requesterId), { following: increment(1) });
    }

    tx.delete(requestRef);
  });
}

export async function unfollowUser(requesterId: string, targetId: string) {
  const followRef = doc(db, "follows", `${requesterId}_${targetId}`);
  const followerRef = doc(db, "users", targetId, "followers", requesterId);
  const followingRef = doc(db, "users", requesterId, "following", targetId);

  await runTransaction(db, async (tx) => {
    const followSnap = await tx.get(followRef);
    if (!followSnap.exists()) return;

    tx.delete(followRef);
    tx.delete(followerRef);
    tx.delete(followingRef);
    tx.update(doc(db, "users", targetId), { followers: increment(-1) });
    tx.update(doc(db, "users", requesterId), { following: increment(-1) });
  });
}

export async function declineFollowRequest(requesterId: string, targetId: string) {
  const requestRef = doc(db, "followRequests", `${requesterId}_${targetId}`);
  
  // Delete the follow request document
  await deleteDoc(requestRef);
}

export function listenToFollowRequests(
  userId: string,
  onNext: (requests: FollowRequest[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, "followRequests"),
    where("targetId", "==", userId),
    where("status", "==", "pending")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const requests = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<FollowRequest, "id">),
      }));
      onNext(requests);
    },
    onError
  );
}

export function listenToSentFollowRequests(
  userId: string,
  onNext: (requests: FollowRequest[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, "followRequests"),
    where("requesterId", "==", userId),
    where("status", "==", "pending")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const requests = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<FollowRequest, "id">),
      }));
      onNext(requests);
    },
    onError
  );
}

export async function checkFollowRequestStatus(
  requesterId: string,
  targetId: string
): Promise<"none" | "pending" | "accepted" | "declined"> {
  const requestRef = doc(db, "followRequests", `${requesterId}_${targetId}`);
  const snapshot = await getDoc(requestRef);
  
  if (!snapshot.exists()) return "none";
  
  const data = snapshot.data() as FollowRequest;
  return data.status;
}
