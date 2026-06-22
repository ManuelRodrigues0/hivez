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

import {
  X,
  Send,
  BadgeCheck,
} from "lucide-react";

import { db } from "../../firebase/firebase";

import { useAuth } from "../../context/AuthContext";

import type { FeedPost } from "../feed/Feed";

import CommentCard from "./CommentCard";

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

  const [comments, setComments] =
    useState<Comment[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [sending, setSending] =
    useState(false);

  const [text, setText] =
    useState("");

  const inputRef =
    useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;

    const q = query(
      collection(
        db,
        "posts",
        post.id,
        "comments"
      ),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Comment[] =
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as Omit<
              Comment,
              "id"
            >),
          }));

        setComments(list);

        setLoading(false);
      }
    );

    return unsubscribe;
  }, [open, post.id]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
    }
  }, [open]);

  async function sendComment() {
    if (!user) return;

    if (!text.trim()) return;

    try {
      setSending(true);

      const userDoc = await getDoc(
        doc(db, "users", user.uid)
      );

      const profile =
        userDoc.data();

      await addDoc(
        collection(
          db,
          "posts",
          post.id,
          "comments"
        ),
        {
          uid: user.uid,

          username:
            profile?.username || "",

          displayName:
            profile?.displayName ||
            user.displayName ||
            "",

          photoURL:
            profile?.photoURL ||
            user.photoURL ||
            "",

          text: text.trim(),

          createdAt:
            serverTimestamp(),
        }
      );

      await updateDoc(
        doc(db, "posts", post.id),
        {
          comments: increment(1),
        }
      );

      setText("");

      inputRef.current?.focus();
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;
  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />

      <div className="fixed bottom-0 left-0 right-0 z-50 flex h-[88vh] flex-col rounded-t-3xl bg-black shadow-2xl animate-in slide-in-from-bottom">

        <div className="flex justify-center py-3">
          <div className="h-1.5 w-12 rounded-full bg-zinc-700" />
        </div>

        <div className="flex items-center justify-between border-b border-zinc-800 px-5 pb-4">

          <h2 className="text-lg font-semibold text-white">
            Comments
          </h2>

          <button
            onClick={onClose}
            className="rounded-full p-2 transition hover:bg-zinc-900"
          >
            <X
              size={22}
              className="text-white"
            />
          </button>

        </div>

        <div className="border-b border-zinc-800 p-5">

          <div className="flex gap-3">

            <img
              src={
                post.photoURL ||
                "https://ui-avatars.com/api/?name=Hivez"
              }
              className="h-11 w-11 rounded-full object-cover"
            />

            <div className="flex-1">

              <div className="flex items-center gap-2">

                <span className="font-semibold text-white">
                  {post.displayName}
                </span>

                {post.verified && (
                  <BadgeCheck
                    size={15}
                    className="text-sky-500"
                  />
                )}

                <span className="text-sm text-zinc-500">
                  @{post.username}
                </span>

              </div>

              {post.caption && (
                <p className="mt-2 whitespace-pre-wrap text-white">
                  {post.caption}
                </p>
              )}

              {post.mediaType === "image" ? (
                <img
                  src={post.mediaUrl}
                  className="mt-4 rounded-2xl"
                />
              ) : (
                <video
                  src={post.mediaUrl}
                  controls
                  className="mt-4 rounded-2xl"
                />
              )}

            </div>

          </div>

        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">

          {loading ? (
            <div className="py-10 text-center text-zinc-500">
              Loading comments...
            </div>
          ) : comments.length === 0 ? (
            <div className="py-10 text-center text-zinc-500">
              Be the first to comment.
            </div>
          ) : (
            comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
              />
            ))
          )}

        </div>

        <div className="border-t border-zinc-800 p-4">

          <div className="flex items-end gap-3">

            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) =>
                setText(e.target.value)
              }
              rows={1}
              placeholder="Write a comment..."
              className="max-h-36 min-h-[48px] flex-1 resize-none rounded-2xl bg-zinc-900 p-3 text-white outline-none"
            />

            <button
              onClick={sendComment}
              disabled={
                sending || !text.trim()
              }
              className="rounded-full bg-sky-500 p-3 transition disabled:opacity-40"
            >
              <Send size={20} />
            </button>

          </div>

        </div>

      </div>
    </>
  );
}