import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";

export interface FollowRequest {
  requesterId: string;
  targetId: string;
  status: "pending" | "accepted" | "declined";
  createdAt: any;
}

export async function createFollowRequest(requesterId: string, targetId: string) {
  const requestRef = doc(db, "followRequests", `${requesterId}_${targetId}`);
  const snapshot = await getDoc(requestRef);
  
  if (snapshot.exists()) return; // Request already exists

  await setDoc(requestRef, {
    requesterId,
    targetId,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function acceptFollowRequest(requesterId: string, targetId: string) {
  const requestRef = doc(db, "followRequests", `${requesterId}_${targetId}`);
  const snapshot = await getDoc(requestRef);
  
  if (!snapshot.exists()) return;

  const batch = writeBatch(db);

  // Update request status
  batch.update(requestRef, { status: "accepted" });

  // Create follow relationship
  const followRef = doc(db, "follows", `${requesterId}_${targetId}`);
  const followerRef = doc(db, "users", targetId, "followers", requesterId);
  const followingRef = doc(db, "users", requesterId, "following", targetId);

  const followData = {
    followerId: requesterId,
    followingId: targetId,
    createdAt: serverTimestamp(),
  };

  batch.set(followRef, followData);
  batch.set(followerRef, followData);
  batch.set(followingRef, followData);

  // Update follower counts
  batch.update(doc(db, "users", targetId), { followers: increment(1) });
  batch.update(doc(db, "users", requesterId), { following: increment(1) });

  await batch.commit();
}

export async function declineFollowRequest(requesterId: string, targetId: string) {
  const requestRef = doc(db, "followRequests", `${requesterId}_${targetId}`);
  await updateDoc(requestRef, { status: "declined" });
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
