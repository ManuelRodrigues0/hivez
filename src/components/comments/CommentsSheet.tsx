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
        className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm transition-opacity"
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

      {/* Desktop: full-screen overlay that replaces the feed */}
      <div className="hidden sm:flex fixed inset-0 z-[100] bg-black">
        <div className="flex w-full max-w-2xl flex-col mx-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-black/95 px-4 py-3 backdrop-blur">
            <button
              onClick={onClose}
              className="rounded-full p-2 transition hover:bg-zinc-800"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base font-semibold text-white">Replies</h1>
            <div className="w-10" />
          </div>

          {/* Original Post */}
          <OriginalPost post={post} />

          {/* Scrollable comment feed */}
          <div className="flex-1 overflow-y-auto">
            <CommentList comments={comments} loading={loading} />
          </div>

          {/* Composer at bottom */}
          <div className="border-t border-zinc-800 p-4">
            <CommentComposer
              ref={textareaRef}
              value={text}
              sending={sending}
              onChange={setText}
              onSend={sendComment}
            />
          </div>
        </div>
      </div>
    </>
  );
}