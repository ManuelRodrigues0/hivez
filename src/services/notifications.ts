import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";
import { normalizePrivacy } from "@/services/privacy";
import { timestampMillis, type TimestampLike } from "@/types/timestamp";

export type NotificationType = "comment" | "like" | "follow" | "broadcast" | "rehive" | "mention" | "message";
type StoredNotificationType = NotificationType;

export interface NotificationActor {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
}

export interface NotificationDoc {
  id: string;
  recipientId: string;
  actorId: string;
  actorUsername: string;
  actorDisplayName: string;
  actorPhotoURL: string;
  type: StoredNotificationType;
  text: string;
  link: string;
  postId?: string;
  chatId?: string;
  commentId?: string;
  read: boolean;
  createdAt?: TimestampLike | null;
}

interface CreateNotificationInput {
  recipientId?: string;
  actor: NotificationActor;
  type: NotificationType;
  text: string;
  link: string;
  postId?: string;
  chatId?: string;
  commentId?: string;
}

export async function createNotification({
  recipientId,
  actor,
  type,
  text,
  link,
  postId,
  chatId,
  commentId,
}: CreateNotificationInput) {
  if (!recipientId || recipientId === actor.uid) return;

  const recipientSnap = await getDoc(doc(db, "users", recipientId));
  const recipient = recipientSnap.data();
  const notificationPrefs = (recipient?.notificationPreferences || {}) as Record<string, boolean>;
  const privacy = normalizePrivacy(recipient);
  const prefKey = type === "rehive" ? "reHives" : `${type}s`;
  if (notificationPrefs[prefKey] === false) return;
  if (type === "mention" && privacy.mentions === "nobody") return;

  await addDoc(collection(db, "notifications"), {
    recipientId,
    actorId: actor.uid,
    actorUsername: actor.username || "",
    actorDisplayName: actor.displayName || actor.username || "Hivez User",
    actorPhotoURL: actor.photoURL || "",
    type,
    text,
    link,
    postId: postId || null,
    chatId: chatId || null,
    commentId: commentId || null,
    read: false,
    createdAt: serverTimestamp(),
  });
}

export function listenToNotifications(
  uid: string,
  onNext: (notifications: NotificationDoc[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      onNext(
        snapshot.docs
          .map((notificationDoc) => ({
            id: notificationDoc.id,
            ...(notificationDoc.data() as Omit<NotificationDoc, "id">),
          }))
          .filter((notification) => isVisibleNotificationType(notification.type))
          .sort((a, b) => {
            const aTime = timestampMillis(a.createdAt);
            const bTime = timestampMillis(b.createdAt);
            return bTime - aTime;
          })
      );
    },
    onError
  );
}

export function listenToUnreadNotificationsCount(
  uid: string,
  onNext: (count: number) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", uid)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      onNext(
        snapshot.docs.filter((notificationDoc) => {
          const notification = notificationDoc.data() as NotificationDoc;
          return !notification.read && isVisibleNotificationType(notification.type);
        }).length
      );
    },
    onError
  );
}

export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

export async function markAllNotificationsRead(uid: string) {
  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", uid)
  );
  const countSnapshot = await getCountFromServer(q);
  if (countSnapshot.data().count === 0) return;

  const unreadSnapshot = await getDocs(q);
  const batch = writeBatch(db);
  unreadSnapshot.docs.forEach((notificationDoc) => {
    const notification = notificationDoc.data() as NotificationDoc;
    if (!notification.read && isVisibleNotificationType(notification.type)) {
      batch.update(notificationDoc.ref, { read: true });
    }
  });
  await batch.commit();
}

function isVisibleNotificationType(type: StoredNotificationType) {
  return (
    type === "comment" ||
    type === "like" ||
    type === "follow" ||
    type === "broadcast" ||
    type === "rehive" ||
    type === "mention" ||
    type === "message"
  );
}
