import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

initializeApp();

const db = getFirestore();

async function sendToUser(
  uid: string,
  title: string,
  body: string,
  link: string
) {
  const tokensSnapshot = await db.collection("users").doc(uid).collection("pushTokens").get();
  const tokens = tokensSnapshot.docs.map((doc) => doc.id);

  if (!tokens.length) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title,
      body,
    },
    webpush: {
      fcmOptions: {
        link,
      },
      notification: {
        icon: "/favicon.svg",
        badge: "/favicon.svg",
      },
    },
    data: {
      title,
      body,
      link,
    },
  });

  await Promise.all(
    response.responses.map(async (result, index) => {
      if (!result.success) {
        const code = result.error?.code || "";
        if (code.includes("registration-token-not-registered") || code.includes("invalid-argument")) {
          await tokensSnapshot.docs[index].ref.delete();
        }
      }
    })
  );
}

export const pushSocialNotification = onDocumentCreated(
  "notifications/{notificationId}",
  async (event) => {
    const notification = event.data?.data();
    if (!notification || notification.type === "message") return;

    const actorName = notification.actorDisplayName || notification.actorUsername || "Someone";
    const title =
      notification.type === "comment"
        ? `${actorName} commented on your post`
        : notification.type === "follow"
        ? `${actorName} followed you`
        : `${actorName} liked your post`;

    await sendToUser(
      notification.recipientId,
      title,
      notification.type === "follow" ? `@${notification.actorUsername}` : notification.text || "",
      notification.link || "/notifications"
    );
  }
);

export const pushChatMessage = onDocumentCreated(
  "chats/{chatId}/messages/{messageId}",
  async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const chatSnap = await db.collection("chats").doc(event.params.chatId).get();
    const chat = chatSnap.data();
    const recipientId = chat?.participants?.find((uid: string) => uid !== message.senderId);
    if (!recipientId) return;

    const sender = chat?.participantProfiles?.[message.senderId];
    const senderName = sender?.displayName || sender?.username || "Someone";

    await sendToUser(
      recipientId,
      `${senderName} sent you a message`,
      message.text || "New message",
      "/chats"
    );
  }
);
