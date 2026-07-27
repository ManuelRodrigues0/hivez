import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";

import { db, getFirebaseMessaging } from "@/firebase/firebase";

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

export async function enablePushNotifications(uid: string) {
  if (!("Notification" in window)) {
    throw new Error("This browser does not support system notifications.");
  }

  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser does not support service workers.");
  }

  if (!vapidKey) {
    throw new Error("Missing VITE_FIREBASE_VAPID_KEY.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    throw new Error("Firebase messaging is not supported in this browser.");
  }

  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error("Could not create a push notification token.");
  }

  await setDoc(
    doc(db, "users", uid, "pushTokens", token),
    {
      token,
      enabled: true,
      platform: "web",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return token;
}

export async function listenForForegroundPushNotifications() {
  const messaging = await getFirebaseMessaging();
  if (!messaging || Notification.permission !== "granted") return () => {};

  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.title || "Hivez";
    const body = payload.notification?.body || payload.data?.body || "";
    const link = payload.fcmOptions?.link || payload.data?.link || "/";

    const notification = new Notification(title, {
      body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      data: { link },
    });

    notification.onclick = () => {
      window.focus();
      window.location.href = link;
      notification.close();
    };
  });
}
