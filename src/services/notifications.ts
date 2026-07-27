import {
  addDoc,
  collection,
  doc,
  getCountFromServer,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";

export type NotificationType = "comment" | "like" | "follow";

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
  type: NotificationType;
  text: string;
  link: string;
  postId?: string;
  chatId?: string;
  commentId?: string;
  read: boolean;
  createdAt: any;
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
    where("recipientId", "==", uid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(
    q,
    (snapshot) => {
      onNext(
        snapshot.docs.map((notificationDoc) => ({
          id: notificationDoc.id,
          ...(notificationDoc.data() as Omit<NotificationDoc, "id">),
        }))
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
    where("recipientId", "==", uid),
    where("read", "==", false)
  );

  return onSnapshot(q, (snapshot) => onNext(snapshot.size), onError);
}

export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(db, "notifications", notificationId), { read: true });
}

export async function markAllNotificationsRead(uid: string) {
  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", uid),
    where("read", "==", false)
  );
  const snapshot = await getCountFromServer(q);
  if (snapshot.data().count === 0) return;

  const unreadSnapshot = await getDocs(q);
  const batch = writeBatch(db);
  unreadSnapshot.docs.forEach((notificationDoc) => {
    batch.update(notificationDoc.ref, { read: true });
  });
  await batch.commit();
}
