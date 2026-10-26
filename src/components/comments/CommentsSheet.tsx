/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { doc, getDoc } from "firebase/firestore";
import { toast } from "sonner";

import { db } from "../../firebase/firebase";

import { useAuth } from "../../context/AuthContext";
import {
  addPostComment,
  getActiveMentionQuery,
  listenToPostComments,
  type CommentDoc,
} from "@/services/comments";
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

export default function CommentsSheet({ post, open, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<CommentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<CommentDoc | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<
    SearchableUser[]
  >([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError("");
    setComments([]);

    const unsubscribe = listenToPostComments(
      post.id,
      (data) => {
        setComments(data);
        setLoading(false);
      },
      (error) => {
        console.error("Comments listener failed:", error);
        setLoadError("Could not load replies. Please try again.");
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [open, post.id, reload]);

  useEffect(() => {
    setText("");
    setReplyTo(null);
  }, [post.id]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => textareaRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
    };
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

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        const people = await searchUsers(mentionQuery, user.uid, 6);
        if (active) setMentionSuggestions(people);
      } catch (error) {
        console.warn("Mention suggestions are unavailable:", error);
        if (active) setMentionSuggestions([]);
      }
    }, 220);

    return () => { active = false; window.clearTimeout(timeout); };
  }, [open, text, user]);

  async function sendComment() {
    if (!user || sendLock.current || !text.trim()) return;
    sendLock.current = true;
    const submittedText = text.trim();
    const submittedReply = replyTo;

    try {
      setSending(true);

      // Live profile from AuthContext (fresh without extra reads), falling
      // back to a direct read if it has not streamed in yet.
      const profileData =
        profile || (await getDoc(doc(db, "users", user.uid))).data();

      await addPostComment({
        post,
        actor: {
          uid: user.uid,
          username: profileData?.username || "",
          displayName: profileData?.displayName || user.displayName || "",
          photoURL: profileData?.photoURL || user.photoURL || "",
        },
        text: submittedText,
        parentId: submittedReply?.id ?? null,
      });

      // The saved comment can appear before its optional notifications finish.
      // Keep a new reply target/draft selected during that short interval.
      setText(current => current.trim() === submittedText ? "" : current);
      setReplyTo(current => current === submittedReply ? null : current);
      setMentionSuggestions([]);
      textareaRef.current?.focus();
    } catch (err) {
      console.error("Failed to send comment:", err);
      toast.error(
        err instanceof Error ? err.message : "Could not post comment",
      );
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  }

  function insertMention(person: SearchableUser) {
    setText((current) =>
      current.replace(
        /(^|\s)@[a-z0-9_]{1,24}$/i,
        (_, prefix: string) => `${prefix}@${person.username} `,
      ),
    );
    setMentionSuggestions([]);
    textareaRef.current?.focus();
  }

  const replyComposerProps = {
    sending,
    replyToLabel: replyTo?.username,
    onCancelReply: () => setReplyTo(null),
    mentionSuggestions,
    onSelectMention: insertMention,
  };

  return (
    <dialog
      ref={dialogRef}
      className="hv-replies"
      aria-label="Replies"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <CommentHeader count={comments.length} onClose={onClose} />
      <div className="hv-reply-original">
        <OriginalPost post={post} />
      </div>
      <div className="hv-reply-list">
        {loadError ? <div role="alert" className="p-5 text-sm"><p>{loadError}</p><button type="button" onClick={() => setReload(value => value + 1)} className="mt-3 font-semibold text-primary">Retry</button></div> :
        <CommentList
          comments={comments}
          loading={loading}
          postId={post.id}
          onReply={comment => { setReplyTo(comment); textareaRef.current?.focus(); }}
        />
        }
      </div>
      {user ? (
        <CommentComposer
          ref={textareaRef}
          value={text}
          onChange={setText}
          onSend={sendComment}
          {...replyComposerProps}
        />
      ) : (
        <div className="flex items-center justify-between gap-3 border-t border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black/95">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Sign in to join the conversation.</p>
          <button
            type="button"
            onClick={() => navigate("/login", { state: { from: location.pathname } })}
            className="shrink-0 rounded-full bg-[#3d654c] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#32533e] dark:bg-[#f2c14e] dark:text-[#121212] dark:hover:bg-[#dfb041]"
          >
            Sign in
          </button>
        </div>
      )}
    </dialog>
  );
}
