import { useState } from "react";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  MoreHorizontal,
  BadgeCheck,
} from "lucide-react";

import type { Post } from "../../data/posts";

interface Props {
  post: Post;
}

export default function FeedCard({ post }: Props) {
  const [liked, setLiked] = useState(false);

  return (
    <article className="border-b border-zinc-800 px-4 py-5">
      <div className="flex gap-3">

        {/* Avatar */}
        <div className="flex flex-col items-center">

          <img
            src={post.avatar}
            alt={post.username}
            className="h-11 w-11 rounded-full object-cover"
          />

          <div className="mt-2 flex-1 w-px bg-zinc-800"></div>

          {/* Reply Avatars */}
          <div className="-mt-1 flex -space-x-2 pb-2">
            <img
              src="https://i.pravatar.cc/40?img=10"
              className="h-5 w-5 rounded-full border border-black"
            />
            <img
              src="https://i.pravatar.cc/40?img=12"
              className="h-5 w-5 rounded-full border border-black"
            />
          </div>

        </div>

        {/* Content */}
        <div className="flex-1">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-2">

              <span className="font-semibold">
                {post.username}
              </span>

              <BadgeCheck
                size={15}
                className="text-sky-500"
              />

              <span className="text-sm text-zinc-500">
                {post.time}
              </span>

            </div>

            <MoreHorizontal
              size={18}
              className="cursor-pointer"
            />

          </div>

          <p className="text-sm text-zinc-500">
            {post.handle}
          </p>

          <p className="mt-3 whitespace-pre-wrap leading-6">
            {post.content}
          </p>

          {post.image && (
            <img
              src={post.image}
              alt=""
              className="mt-4 w-full rounded-2xl object-cover"
            />
          )}

          {/* Buttons */}

          <div className="mt-4 flex items-center gap-6">

            <Heart
              size={22}
              onClick={() => setLiked(!liked)}
              className={`cursor-pointer transition-all duration-200 hover:scale-125 ${
                liked
                  ? "fill-red-500 text-red-500"
                  : ""
              }`}
            />

            <MessageCircle
              size={22}
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

          <div className="mt-3 flex items-center gap-2 text-sm text-zinc-500">

            <span>
              {post.likes.toLocaleString()} likes
            </span>

            <span>•</span>

            <span>
              {post.comments} replies
            </span>

            <span>•</span>

            <span>
              {post.reposts} reposts
            </span>

          </div>

        </div>

      </div>
    </article>
  );
}