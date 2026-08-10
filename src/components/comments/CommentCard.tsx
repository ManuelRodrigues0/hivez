import { Heart, MessageCircle, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface Comment {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  text: string;
  createdAt: any;
}

interface Props {
  comment: Comment;
  depth?: number;
}

function timeAgo(timestamp: any) {
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

export default function CommentCard({ comment, depth = 0 }: Props) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const marginLeft = Math.min(depth * 16, 48);

  return (
    <div style={{ marginLeft }}>
      <article className="group flex gap-2.5 rounded-2xl px-4 py-3 transition hover:bg-zinc-100 dark:hover:bg-zinc-900/50">
        <img
          src={
            comment.photoURL ||
            "https://ui-avatars.com/api/?name=Hivez&background=27272a&color=fff"
          }
          alt={comment.username}
          className="mt-1 h-8 w-8 flex-shrink-0 rounded-full object-cover"
          onClick={() => navigate(`/profile?uid=${comment.uid}`)}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className="text-sm font-semibold text-zinc-900 dark:text-white hover:underline cursor-pointer"
              onClick={() => navigate(`/profile?uid=${comment.uid}`)}
            >
              {comment.displayName}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              @{comment.username}
            </span>
            <span className="text-xs text-zinc-400 dark:text-zinc-600">·</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {timeAgo(comment.createdAt)}
            </span>
          </div>

          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 text-zinc-900 dark:text-zinc-100">
            {comment.text}
          </p>

          <div className="mt-1.5 flex items-center gap-4">
            <button
              onClick={() => setLiked(!liked)}
              className="flex items-center gap-1 rounded-full p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Heart
                size={14}
                className={liked ? "fill-red-500 text-red-500" : "text-zinc-500 dark:text-zinc-400"}
              />
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
                    <button className="w-full px-3 py-2 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                      Copy text
                    </button>
                    <button className="w-full px-3 py-2 text-left text-xs text-red-600 dark:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
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
