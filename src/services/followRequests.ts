import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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
  
  // If request exists and is pending, don't create duplicate
  if (snapshot.exists() && snapshot.data()?.status === "pending") {
    return; // Request already exists
  }

  // Create or update the request (in case it was previously declined)
  await setDoc(requestRef, {
    requesterId,
    targetId,
    status: "pending",
    createdAt: serverTimestamp(),
  }, { merge: true });
}

export async function acceptFollowRequest(requesterId: string, targetId: string) {
  const requestRef = doc(db, "followRequests", `${requesterId}_${targetId}`);
  const snapshot = await getDoc(requestRef);
  
  if (!snapshot.exists()) return;

  // Create follow relationship first
  const followRef = doc(db, "follows", `${requesterId}_${targetId}`);
  const followerRef = doc(db, "users", targetId, "followers", requesterId);
  const followingRef = doc(db, "users", requesterId, "following", targetId);

  const followData = {
    followerId: requesterId,
    followingId: targetId,
    createdAt: serverTimestamp(),
  };

  await setDoc(followRef, followData);
  await setDoc(followerRef, followData);
  await setDoc(followingRef, followData);

  // Update follower counts
  await updateDoc(doc(db, "users", targetId), { followers: increment(1) });
  await updateDoc(doc(db, "users", requesterId), { following: increment(1) });

  // Delete the follow request document
  await deleteDoc(requestRef);
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
