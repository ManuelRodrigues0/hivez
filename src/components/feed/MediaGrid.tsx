import { useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export interface PostMediaItem {
  url: string;
  type: "image" | "video";
  muted?: boolean;
}

interface Props {
  items: PostMediaItem[];
  compact?: boolean;
}

export default function MediaGrid({ items, compact = false }: Props) {
  if (!items.length) return null;

  const single = items.length === 1;

  return (
    <div>
      {single ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900">
          <MediaItem item={items[0]} single compact={compact} />
        </div>
      ) : (
        <div className="flex w-full max-w-full snap-x gap-1.5 overflow-x-auto overscroll-x-contain rounded-2xl">
          {items.map((item, index) => (
            <div
              key={`${item.url}-${index}`}
              className={`relative flex-shrink-0 snap-start overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 ${
                compact ? "h-64 w-48" : "h-[344px] w-[var(--media-card-width)]"
              }`}
            >
              <MediaItem item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaItem({
  item,
  single = false,
  compact = false,
}: {
  item: PostMediaItem;
  single?: boolean;
  compact?: boolean;
}) {
  const [muted, setMuted] = useState(item.muted ?? true);
  const singleClass = compact ? "max-h-80" : "max-h-[620px]";

  if (item.type === "video") {
    return (
      <div className="relative w-full min-h-[200px]" style={{ height: single ? 'auto' : '100%' }}>
        <video
          src={item.url}
          muted={muted}
          playsInline
          autoPlay
          loop
          className={`w-full ${single ? `${singleClass} object-contain` : "h-full object-cover"}`}
        />
        <button
          onClick={() => setMuted(!muted)}
          className="absolute bottom-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/80 text-white backdrop-blur-md transition hover:bg-black hover:scale-110"
        >
          {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>
    );
  }

  return (
    <img
      src={item.url}
      alt=""
      className={`h-full w-full ${single ? `${singleClass} object-contain` : "object-cover"}`}
    />
  );
}