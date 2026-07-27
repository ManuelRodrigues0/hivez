export interface PostMediaItem {
  url: string;
  type: "image" | "video";
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
              {item.type === "video" && (
                <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                  Video
                </div>
              )}
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
  const singleClass = compact ? "max-h-80" : "max-h-[620px]";

  if (item.type === "video") {
    return (
      <video
        src={item.url}
        controls={single}
        muted={!single}
        playsInline
        className={`h-full w-full ${single ? `${singleClass} object-contain` : "object-cover"}`}
      />
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
