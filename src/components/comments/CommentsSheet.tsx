import { useEffect, useRef, useState } from "react";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";

import { useAuth } from "../../context/AuthContext";

import type { FeedPost } from "../feed/Feed";

import CommentHeader from "./CommentHeader";
import OriginalPost from "./OriginalPost";
import CommentList from "./CommentList";
import CommentComposer from "./CommentComposer";

interface Props {
  post: FeedPost;
  open: boolean;
  onClose: () => void;
}

interface Comment {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  text: string;
  createdAt: any;
}

export default function CommentsSheet({
  post,
  open,
  onClose,
}: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const q = query(
      collection(db, "posts", post.id, "comments"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Comment[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Comment, "id">),
      }));
      setComments(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [open, post.id]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 250);
  }, [open]);

  async function sendComment() {
    if (!user) return;
    if (!text.trim()) return;

    try {
      setSending(true);

      const userSnap = await getDoc(doc(db, "users", user.uid));
      const profile = userSnap.data();

      await addDoc(
        collection(db, "posts", post.id, "comments"),
        {
          uid: user.uid,
          username: profile?.username || "",
          displayName: profile?.displayName || user.displayName || "",
          photoURL: profile?.photoURL || user.photoURL || "",
          text: text.trim(),
          createdAt: serverTimestamp(),
        }
      );

      await updateDoc(doc(db, "posts", post.id), {
        comments: increment(1),
      });

      setText("");
      textareaRef.current?.focus();
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm transition-opacity"
      />

      {/* Mobile: bottom sheet */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-[100] mx-auto h-[92vh] w-full rounded-t-[32px] border border-zinc-800 bg-black shadow-2xl">
        <div className="flex h-full flex-col overflow-hidden rounded-t-[32px]">
          <CommentHeader count={comments.length} onClose={onClose} />
          <OriginalPost post={post} />
          <CommentList comments={comments} loading={loading} />
          <CommentComposer
            ref={textareaRef}
            value={text}
            sending={sending}
            onChange={setText}
            onSend={sendComment}
          />
        </div>
      </div>

      {/* Desktop: right side panel */}
      <div className="hidden sm:flex fixed inset-y-0 right-0 z-[100] w-full max-w-[480px] flex-col border-l border-zinc-800 bg-black shadow-2xl">
        <CommentHeader count={comments.length} onClose={onClose} />
        <OriginalPost post={post} />
        <CommentList comments={comments} loading={loading} />
        <CommentComposer
          ref={textareaRef}
          value={text}
          sending={sending}
          onChange={setText}
          onSend={sendComment}
        />
      </div>
    </>
  );
}