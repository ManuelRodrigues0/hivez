import {
  auth,
  googleProvider,
} from "../firebase/firebase";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { createUserDocument } from "./user";

export async function signup(
  email: string,
  password: string
) {
  const result =
    await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

  await createUserDocument(result.user);

  return result;
}

export async function login(
  email: string,
  password: string
) {
  return signInWithEmailAndPassword(
    auth,
    email,
    password
  );
}

export async function googleLogin() {
  const result =
    await signInWithPopup(
      auth,
      googleProvider
    );

  await createUserDocument(result.user);

  return result;
}

export async function logout() {
  return signOut(auth);
}