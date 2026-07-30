import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Run this function from your browser's DevTools console
 * to make yourself an admin.
 *
 * Usage:
 *   1. Log in to the app
 *   2. Open DevTools (F12) → Console tab
 *   3. Paste and run:
 *
 *      import { makeMeAdmin } from "./src/services/makeMeAdmin";
 *      makeMeAdmin();
 *
 * Or copy/paste this one-liner after logging in:
 *
 *      fetch(location.origin + "/src/services/makeMeAdmin.ts")
 *        .then(r => r.text())
 *        .then(eval)
 *        .then(() => makeMeAdmin());
 *
 * Simplified version (just copy & paste in console while logged in):
 */
export async function makeMeAdmin() {
  const { getAuth } = await import("firebase/auth");
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user) {
    console.error("❌ You must be logged in first!");
    return;
  }

  try {
    await setDoc(
      doc(db, "users", user.uid),
      { role: "admin" },
      { merge: true }
    );
    console.log("✅ You are now an admin! Go to /admin to access the panel.");
    console.log("👉 Refresh the page, then navigate to /admin");
  } catch (err) {
    console.error("❌ Failed to set admin role:", err);
  }
}