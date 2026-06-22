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

  return `${days}d`;
}

export default function FeedCard({ post }: Props) {
  const [liked, setLiked] = useState(false);

  const [commentsOpen, setCommentsOpen] =
    useState(false);

  return (
    <>
      <article className="border-b border-zinc-800 px-4 py-5">
        <div className="flex gap-3">

          <div className="flex flex-col items-center">

            <img
              src={
                post.photoURL ||
                "https://ui-avatars.com/api/?name=Hivez"
              }
              alt={post.username}
              className="h-11 w-11 rounded-full object-cover"
            />

            <div className="mt-2 w-px flex-1 bg-zinc-800" />

          </div>

          <div className="flex-1">

            <div className="flex items-center justify-between">

              <div className="flex items-center gap-2">

                <span className="font-semibold">
                  {post.displayName || post.username}
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

                <span className="text-sm text-zinc-500">
                  · {timeAgo(post.createdAt)}
                </span>

              </div>

              <MoreHorizontal
                size={18}
                className="cursor-pointer"
              />

            </div>

            {post.caption && (
              <p className="mt-3 whitespace-pre-wrap leading-6">
                {post.caption}
              </p>
            )}

            {post.mediaType === "image" ? (
              <img
                src={post.mediaUrl}
                alt=""
                className="mt-4 w-full rounded-2xl object-cover"
              />
            ) : (
              <video
                src={post.mediaUrl}
                controls
                className="mt-4 w-full rounded-2xl"
              />
            )}

            <div className="mt-4 flex items-center gap-6">

              <Heart
                size={22}
                onClick={() => setLiked(!liked)}
                className={`cursor-pointer transition ${
                  liked
                    ? "fill-red-500 text-red-500"
                    : ""
                }`}
              />

              <MessageCircle
                size={22}
                onClick={() =>
                  setCommentsOpen(true)
                }
                className="cursor-pointer transition hover:scale-110"
              />

              <Repeat2
                size={22}
                className="cursor-pointer transition hover:scale-110"
              />

              <Send
                size={22}
                className="cursor-pointer transition hover:scale-110"
              />

            </div>

            <div className="mt-3 flex gap-2 text-sm text-zinc-500">

              <span>
                {post.likes} upvotes
              </span>

              <span>•</span>

              <span>
                {post.comments} comments
              </span>

              <span>•</span>

              <span>
                {post.shares} shares
              </span>

            </div>

          </div>

        </div>

      </article>
      <CommentsSheet
        post={post}
        open={commentsOpen}
        onClose={() =>
          setCommentsOpen(false)
        }
      />

    </>
  );
}