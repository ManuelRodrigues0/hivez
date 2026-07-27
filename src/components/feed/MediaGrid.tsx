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

  const visibleItems = items.slice(0, 4);
  const extraCount = items.length - visibleItems.length;
  const single = visibleItems.length === 1;

  return (
    <div
      className={`grid overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 ${
        single ? "" : "grid-cols-2 gap-1"
      }`}
    >
      {visibleItems.map((item, index) => (
        <div
          key={`${item.url}-${index}`}
          className={`relative overflow-hidden bg-zinc-100 dark:bg-zinc-900 ${
            single
              ? compact
                ? "max-h-80"
                : "max-h-[620px]"
              : compact
              ? "aspect-square"
              : "aspect-[3/4]"
          }`}
        >
          {item.type === "video" ? (
            <video
              src={item.url}
              controls={single}
              muted={!single}
              playsInline
              className={`h-full w-full ${single ? "object-contain" : "object-cover"}`}
            />
          ) : (
            <img
              src={item.url}
              alt=""
              className={`h-full w-full ${single ? "object-contain" : "object-cover"}`}
            />
          )}
          {!single && item.type === "video" && (
            <div className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
              Video
            </div>
          )}
          {extraCount > 0 && index === visibleItems.length - 1 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-2xl font-bold text-white">
              +{extraCount}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
