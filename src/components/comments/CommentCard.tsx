import { Copy, Flag, Heart, MessageCircle, MoreHorizontal, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useLiveProfile } from "@/hooks/useLiveProfile";
import { useAuth } from "@/context/AuthContext";
import {
  deleteComment,
  listenToCommentLikeState,
  reportComment,
  toggleCommentLike,
  type CommentDoc,
} from "@/services/comments";
import type { TimestampLike } from "@/types/timestamp";

interface Props {
  comment: CommentDoc;
  postId: string;
  depth?: number;
}

function timeAgo(timestamp?: TimestampLike | null) {
  if (!timestamp?.toDate) return "Now";

  const seconds = Math.floor(
    (Date.now() - timestamp.toDate().getTime()) / 1000
  );

  if (seconds < 60) return "Now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  const years = Math.floor(days / 365);
  return `${years}y`;
}

export default function CommentCard({ comment, postId, depth = 0 }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [showActions, setShowActions] = useState(false);
  // Live commenter profile falls back to the snapshot stored on the comment.
  const author = useLiveProfile(comment.uid, comment) as CommentDoc;
  const mentionMap = useMemo(
    () => new Map((comment.mentions || []).map((mention) => [mention.username.toLowerCase(), mention.uid])),
    [comment.mentions]
  );

  const marginLeft = Math.min(depth * 16, 48);

  useEffect(() => {
    return listenToCommentLikeState(user?.uid, postId, comment.id, setLiked);
  }, [comment.id, postId, user?.uid]);

  async function handleLike() {
    if (!user || likeBusy) return;
    setLikeBusy(true);
    try {
      await toggleCommentLike(postId, comment.id, user.uid);
    } catch (err) {
      console.error("Failed to like comment:", err);
      toast.error("Could not update comment like");
    } finally {
      setLikeBusy(false);
    }
  }

  async function copyText() {
    await navigator.clipboard.writeText(comment.text);
    setShowActions(false);
    toast.success("Comment copied");
  }

  async function report() {
    if (!user) return;
    await reportComment({ postId, commentId: comment.id, reporterId: user.uid });
    setShowActions(false);
    toast.success("Comment reported");
  }

  async function remove() {
    if (!user || user.uid !== comment.uid) return;
    await deleteComment(postId, comment.id);
    setShowActions(false);
  }

  function renderCommentText() {
    const pieces = comment.text.split(/(@[a-z0-9_]{3,24})/gi);
    return pieces.map((piece, index) => {
      if (!piece.startsWith("@")) return <span key={`${piece}-${index}`}>{piece}</span>;
      const username = piece.slice(1).toLowerCase();
      const uid = mentionMap.get(username);
      if (!uid) return <span key={`${piece}-${index}`}>{piece}</span>;
      return (
        <button
          key={`${piece}-${index}`}
          type="button"
          onClick={() => navigate(`/profile?uid=${uid}`)}
          className="font-bold text-[#3d654c] hover:underline dark:text-[#f2c14e]"
        >
          {piece}
        </button>
      );
    });
  }

  return (
    <div style={{ marginLeft }}>
      <article className="group flex gap-2.5 rounded-2xl px-4 py-3 transition hover:bg-zinc-100 dark:hover:bg-zinc-900/50">
        <img
          src={
            author.photoURL ||
            "https://ui-avatars.com/api/?name=Hivez&background=27272a&color=fff"
          }
          alt={author.username}
          className="mt-1 h-8 w-8 flex-shrink-0 rounded-full object-cover"
          onClick={() => navigate(`/profile?uid=${comment.uid}`)}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="text-sm font-semibold text-zinc-900 dark:text-white hover:underline cursor-pointer"
              onClick={() => navigate(`/profile?uid=${comment.uid}`)}
            >
              {author.displayName}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              @{author.username}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-600">·</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 text-zinc-900 dark:text-zinc-100">
            {renderCommentText()}
          </p>

          <div className="mt-1.5 flex items-center gap-4">
            <button
              onClick={handleLike}
              disabled={!user || likeBusy}
              className="flex items-center gap-1 rounded-full p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Heart
                size={14}
                className={liked ? "fill-red-500 text-red-500" : "text-zinc-500 dark:text-zinc-400"}
              />
              {Boolean(comment.likes) && (
                <span className={`text-[11px] font-bold ${liked ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {comment.likes}
                </span>
              )}
            </button>
            <button className="flex items-center gap-1 rounded-full p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <MessageCircle size={14} className="text-zinc-500 dark:text-zinc-400" />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowActions(!showActions)}
                className="rounded-full p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800 opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal size={14} className="text-zinc-500 dark:text-zinc-400" />
              </button>
              {showActions && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowActions(false)}
                  />
                  <div className="app-popover-menu absolute bottom-full right-0 z-50 mb-1 w-36 rounded-xl border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                    <button onClick={copyText} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <Copy size={12} />
                      Copy text
                    </button>
                    {user?.uid === comment.uid && (
                      <button onClick={remove} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <Trash2 size={12} />
                        Delete
                      </button>
                    )}
                    <button onClick={report} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      <Flag size={12} />
                      Report
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
