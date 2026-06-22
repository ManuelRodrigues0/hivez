import { BadgeCheck } from "lucide-react";

import type { FeedPost } from "../feed/Feed";

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

export default function OriginalPost({
  post,
}: Props) {
  return (
    <section className="sticky top-[76px] z-20 border-b border-zinc-800 bg-black px-5 py-4">

      <div className="flex gap-3">

        <img
          src={
            post.photoURL ||
            "https://ui-avatars.com/api/?name=Hivez"
          }
          alt={post.username}
          className="h-11 w-11 rounded-full object-cover"
        />

        <div className="flex-1">

          <div className="flex items-center gap-2">

            <span className="font-semibold text-white">
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

          {post.caption && (
            <p className="mt-3 whitespace-pre-wrap text-white">
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

        </div>

      </div>

    </section>
  );
}