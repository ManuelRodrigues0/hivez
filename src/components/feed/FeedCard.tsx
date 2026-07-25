import { useState } from "react";

import {
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  MoreHorizontal,
  BadgeCheck,
  MapPin,
} from "lucide-react";

import type { FeedPost } from "./Feed";

import CommentsSheet from "../comments/CommentsSheet";

interface Props {
  post: FeedPost;
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

export default function FeedCard({ post }: Props) {
  const [liked, setLiked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <>
      <article className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={
                  post.photoURL ||
                  "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"
                }
                alt={post.username}
                className="h-10 w-10 rounded-full object-cover"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">
                    {post.displayName || post.username}
                  </span>
                  {post.verified && (
                    <BadgeCheck size={14} className="text-sky-500" />
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span>@{post.username}</span>
                  <span>·</span>
                  <span>{timeAgo(post.createdAt)}</span>
                </div>
              </div>
            </div>
            <button className="rounded-full p-1.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <MoreHorizontal size={18} className="text-zinc-600" />
            </button>
          </div>

          {/* Caption */}
          {post.caption && (
            <div className="mt-3">
              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                {post.caption}
              </p>
              {/* Hashtags */}
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {post.hashtags.map((tag, idx) => (
                    <button
                      key={idx}
                      onClick={() => {}}
                      className="text-xs text-sky-500 hover:underline"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
              {/* Location */}
              {post.location && (
                <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
                  <MapPin size={12} />
                  <span>{post.location}</span>
                </div>
              )}
            </div>
          )}

          {/* Media */}
          {post.mediaUrl && (
            <div className="mt-3">
              {post.mediaType === "image" ? (
                <img
                  src={post.mediaUrl}
                  alt=""
                  className="w-full rounded-2xl object-cover"
                />
              ) : (
                <video
                  src={post.mediaUrl}
                  controls
                  className="w-full rounded-2xl"
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
                size={22}
                className={
                  liked
                    ? "fill-red-500 text-red-500"
                    : "text-zinc-700 dark:text-zinc-300"
                }
              />
            </button>
            <button
              onClick={() => setCommentsOpen(true)}
              className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <MessageCircle size={22} className="text-zinc-700 dark:text-zinc-300" />
            </button>
            <button className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Repeat2 size={22} className="text-zinc-700 dark:text-zinc-300" />
            </button>
            <button className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Send size={22} className="text-zinc-700 dark:text-zinc-300" />
            </button>
          </div>

          {/* Stats */}
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className="font-semibold">{post.likes}</span>
            <span className="text-zinc-500">likes</span>
            <span className="text-zinc-300">·</span>
            <button className="text-zinc-500 hover:underline">
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