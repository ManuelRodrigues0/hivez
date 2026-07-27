importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCf6Xc-f6FqIH4ArI_k05q2z_Qr0uOHE8U",
  authDomain: "hivez-21680.firebaseapp.com",
  projectId: "hivez-21680",
  storageBucket: "hivez-21680.firebasestorage.app",
  messagingSenderId: "18417332890",
  appId: "1:18417332890:web:8e17e703d0184ac2f92523",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "Hivez";
  const body = payload.notification?.body || payload.data?.body || "";
  const link = payload.fcmOptions?.link || payload.data?.link || "/";

  self.registration.showNotification(title, {
    body,
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { link },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(clients.openWindow(link));
});
