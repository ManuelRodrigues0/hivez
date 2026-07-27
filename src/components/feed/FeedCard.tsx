import { useState } from "react";

import {
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  MoreHorizontal,
  BadgeCheck,
} from "lucide-react";

import type { FeedPost } from "./Feed";

import CommentsSheet from "../comments/CommentsSheet";

interface Props {
  post: FeedPost;
  onCommentClick?: (post: FeedPost) => void;
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

export default function FeedCard({ post, onCommentClick }: Props) {
  const [liked, setLiked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <>
      <article className="border-y border-zinc-800 dark:border-zinc-800 border-zinc-200">
        <div className="mx-auto max-w-2xl px-4 py-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={
                  post.photoURL ||
                  "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"
                }
                alt={post.username}
                className="h-9 w-9 rounded-full object-cover"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                    {post.displayName || post.username}
                  </span>
                  {post.verified && (
                    <BadgeCheck size={14} className="text-sky-500" />
                  )}
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    @{post.username}
                  </span>
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    · {timeAgo(post.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            <button className="rounded-full p-1.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <MoreHorizontal size={18} className="text-zinc-500 dark:text-zinc-400" />
            </button>
          </div>

          {/* Caption */}
          {post.caption && (
            <div className="mt-2.5">
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-zinc-900 dark:text-zinc-100">
                {post.caption}
              </p>
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {post.hashtags.map((tag, idx) => (
                    <button
                      key={idx}
                      className="text-xs text-sky-500 hover:underline"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Media - smaller */}
          {post.mediaUrl && (
            <div className="mt-2.5">
              {post.mediaType === "image" ? (
                <img
                  src={post.mediaUrl}
                  alt=""
                  className="max-h-[280px] w-full rounded-xl object-cover"
                />
              ) : (
                <video
                  src={post.mediaUrl}
                  controls
                  className="w-full rounded-xl"
                />
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-1">
            <button
              onClick={() => setLiked(!liked)}
              className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Heart
                size={18}
                className={
                  liked
                    ? "fill-red-500 text-red-500"
                    : "text-zinc-500 dark:text-zinc-400"
                }
              />
            </button>
            <button
              onClick={() => onCommentClick?.(post)}
              className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <MessageCircle size={18} className="text-zinc-500 dark:text-zinc-400" />
            </button>
            <button className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Repeat2 size={18} className="text-zinc-500 dark:text-zinc-400" />
            </button>
            <button className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Send size={18} className="text-zinc-500 dark:text-zinc-400" />
            </button>
          </div>

          {/* Stats */}
          <div className="mt-1.5 flex items-center gap-2 text-sm">
            <span className="font-semibold text-zinc-900 dark:text-white">{post.likes}</span>
            <span className="text-zinc-500 dark:text-zinc-400">likes</span>
            <span className="text-zinc-400 dark:text-zinc-600">·</span>
            <button className="text-zinc-500 dark:text-zinc-400 hover:underline">
              {post.comments} comments
            </button>
          </div>
        </div>
      </article>

      <CommentsSheet
        post={post}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />
    </>
  );
}