import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/firebase/firebase";

export type EngagementEventType =
  | "like"
  | "comment"
  | "share"
  | "save"
  | "view"
  | "volunteer"
  | "confirm"
  | "hide"
  | "report"
  | "profileVisit";

export async function recordPostEngagement(input: {
  postId: string;
  actorId: string;
  type: EngagementEventType;
  authorId?: string;
  category?: string;
}) {
  const id = `${input.postId}_${input.actorId}_${input.type}_${Date.now()}`;
  await setDoc(doc(collection(db, "postEngagements"), id), {
    ...input,
    createdAt: serverTimestamp(),
  });
}
