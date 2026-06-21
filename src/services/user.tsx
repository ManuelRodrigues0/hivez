import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

export async function createUserDocument(user: any) {
  const userRef = doc(db, "users", user.uid);

  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) return;

  await setDoc(userRef, {
    uid: user.uid,

    email: user.email,

    displayName: user.displayName || "",

    username: "",

    bio: "",

    photoURL: user.photoURL || "",

    verified: false,

    followers: 0,

    following: 0,

    posts: 0,

    createdAt: serverTimestamp(),

    lastSeen: serverTimestamp(),
  });
}