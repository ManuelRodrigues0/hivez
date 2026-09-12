/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";

import {
  doc,
  getDoc,
} from "firebase/firestore";
import { toast } from "sonner";

import { db } from "../../firebase/firebase";

import { useAuth } from "../../context/AuthContext";
import { addPostComment, getActiveMentionQuery, listenToPostComments, type CommentDoc } from "@/services/comments";
import { searchUsers, type SearchableUser } from "@/services/privacy";

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

export default function CommentsSheet({
  post,
  open,
  onClose,
}: Props) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [mentionSuggestions, setMentionSuggestions] = useState<SearchableUser[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const unsubscribe = listenToPostComments(
      post.id,
      (data) => {
        setComments(data);
        setLoading(false);
      },
      (error) => {
        console.error("Comments listener failed:", error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [open, post.id]);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 250);
  }, [open]);

  useEffect(() => {
    if (!open || !user) {
      setMentionSuggestions([]);
      return;
    }

    const mentionQuery = getActiveMentionQuery(text);
    if (mentionQuery.length < 2) {
      setMentionSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setMentionSuggestions(await searchUsers(mentionQuery, user.uid, 6));
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [open, text, user]);

  async function sendComment() {
    if (!user) return;
    if (!text.trim()) return;

    try {
      setSending(true);

      // Live profile from AuthContext (fresh without extra reads), falling
      // back to a direct read if it has not streamed in yet.
      const profileData =
        profile ||
        (await getDoc(doc(db, "users", user.uid))).data();

      await addPostComment({
        post,
        actor: {
          uid: user.uid,
          username: profileData?.username || "",
          displayName: profileData?.displayName || user.displayName || "",
          photoURL: profileData?.photoURL || user.photoURL || "",
        },
        text: text.trim(),
      });

      setText("");
      setMentionSuggestions([]);
      textareaRef.current?.focus();
    } catch (err) {
      console.error("Failed to send comment:", err);
      toast.error(err instanceof Error ? err.message : "Could not post comment");
    } finally {
      setSending(false);
    }
  }

  function insertMention(person: SearchableUser) {
    setText((current) =>
      current.replace(/(^|\s)@[a-z0-9_]{1,24}$/i, (_, prefix: string) => `${prefix}@${person.username} `)
    );
    setMentionSuggestions([]);
    textareaRef.current?.focus();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm transition-opacity" />

      {/* Mobile: bottom sheet */}
      <div className="fixed inset-x-0 bottom-0 z-[100] mx-auto h-[92vh] w-full rounded-t-[28px] border border-zinc-200 bg-white shadow-2xl transition-transform dark:border-zinc-800 dark:bg-black sm:hidden">
        <div className="flex h-full flex-col overflow-hidden rounded-t-[28px]">
          <CommentHeader count={comments.length} onClose={onClose} />
          <OriginalPost post={post} />
          <CommentList comments={comments} loading={loading} postId={post.id} />
          <CommentComposer
            ref={textareaRef}
            value={text}
            sending={sending}
            onChange={setText}
            onSend={sendComment}
            mentionSuggestions={mentionSuggestions}
            onSelectMention={insertMention}
          />
        </div>
      </div>

      {/* Desktop: full-screen overlay that replaces the feed */}
      <div className="fixed inset-0 z-[100] hidden bg-white dark:bg-black sm:flex">
        <div className="mx-auto flex w-full max-w-2xl flex-col border-x border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
          {/* Header */}
          <div className="app-sticky-header flex items-center justify-between px-4 py-3">
            <button
              onClick={onClose}
              className="app-icon-button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-900 dark:text-white">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base font-semibold text-zinc-900 dark:text-white">Replies</h1>
            <div className="w-10" />
          </div>

          {/* Original Post */}
          <OriginalPost post={post} />

          {/* Scrollable comment feed */}
          <div className="flex-1 overflow-y-auto">
            <CommentList comments={comments} loading={loading} postId={post.id} />
          </div>

          {/* Composer at bottom */}
          <div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
            <CommentComposer
              ref={textareaRef}
              value={text}
              sending={sending}
              onChange={setText}
              onSend={sendComment}
              mentionSuggestions={mentionSuggestions}
              onSelectMention={insertMention}
            />
          </div>
        </div>
      </div>
    </>
  );
}
