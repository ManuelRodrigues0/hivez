import { BadgeCheck } from "lucide-react";

import type { FeedPost } from "../feed/Feed";
import MediaGrid from "../feed/MediaGrid";
import type { PostMediaItem } from "../feed/MediaGrid";

interface Props {
  post: FeedPost;
}

function timeAgo(timestamp: any) {
  if (!timestamp?.toDate) return "Now";

  const seconds = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (seconds < 60) return "Now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function OriginalPost({ post }: Props) {
  const mediaItems: PostMediaItem[] =
    post.mediaItems?.length
      ? post.mediaItems
      : post.mediaUrls?.length
      ? post.mediaUrls.map((url) => ({ url, type: post.mediaType === "video" ? "video" : "image" }))
      : post.mediaUrl
      ? [{ url: post.mediaUrl, type: post.mediaType === "video" ? "video" : "image" }]
      : [];

  return (
    <section className="sticky top-[76px] z-20 border-b border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-black">
      <div className="flex gap-3">
        <img
          src={post.photoURL || "https://ui-avatars.com/api/?name=Hivez"}
          alt={post.username}
          className="h-11 w-11 rounded-full object-cover"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-white">
              {post.displayName || post.username}
            </span>
            {post.verified && <BadgeCheck size={15} className="text-sky-500" />}
            <span className="text-sm text-zinc-500 dark:text-zinc-400">@{post.username}</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">· {timeAgo(post.createdAt)}</span>
          </div>

          {post.caption && (
            <p className="mt-3 whitespace-pre-wrap break-words text-zinc-900 dark:text-white">
              {post.caption}
            </p>
          )}

          {mediaItems.length > 0 && (
            <div className="mt-4 min-w-0 overflow-hidden">
              <MediaGrid items={mediaItems} compact />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
