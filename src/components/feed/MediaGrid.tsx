import { useState } from "react";
import { AlertTriangle, Volume2, VolumeX } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { sensitiveContentPreference } from "@/services/privacy";

export interface PostMediaItem {
  url: string;
  type: "image" | "video";
  muted?: boolean;
}

interface Props {
  items: PostMediaItem[];
  compact?: boolean;
  sensitive?: boolean;
}

export default function MediaGrid({ items, compact = false, sensitive = false }: Props) {
  if (!items.length) return null;

  const single = items.length === 1;

  return (
    <div>
      {single ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <MediaItem item={items[0]} single compact={compact} sensitive={sensitive} />
        </div>
      ) : (
        <div className="flex w-full max-w-full snap-x gap-1.5 overflow-x-auto overscroll-x-contain rounded-2xl">
          {items.map((item, index) => (
            <div
              key={`${item.url}-${index}`}
              className={`relative flex-shrink-0 snap-start overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${
                compact ? "h-64 w-48" : "h-[344px] w-[var(--media-card-width)]"
              }`}
            >
              <MediaItem item={item} sensitive={sensitive} />
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
  sensitive = false,
}: {
  item: PostMediaItem;
  single?: boolean;
  compact?: boolean;
  sensitive?: boolean;
}) {
  const [muted, setMuted] = useState(item.muted ?? true);
  const { profile } = useAuth();
  const contentPref = sensitiveContentPreference(profile);
  const [revealed, setRevealed] = useState(false);
  const hidden = Boolean(sensitive) && contentPref === "hide";
  const needsBlur = Boolean(sensitive) && contentPref === "blur" && !revealed;
  const singleClass = compact ? "max-h-80" : "max-h-[620px]";

  if (hidden) {
    return (
      <div
        className="flex min-h-[160px] w-full flex-col items-center justify-center gap-1 px-4 py-8 text-center"
        role="img"
        aria-label="Sensitive content hidden by your content settings"
      >
        <AlertTriangle size={20} className="text-zinc-500 dark:text-zinc-400" />
        <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300">Sensitive content hidden</p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Change this in Settings → Privacy</p>
      </div>
    );
  }

  if (needsBlur) {
    return (
      <div className="relative w-full min-h-[200px]">
        {item.type === "video" ? (
          <video
            src={item.url}
            muted
            playsInline
            autoPlay
            loop
            disablePictureInPicture
            aria-hidden="true"
            className={`w-full ${single ? `${singleClass} object-contain` : "h-full object-cover"}`}
          />
        ) : (
          <img
            src={item.url}
            alt=""
            aria-hidden="true"
            className={`h-full w-full ${single ? `${singleClass} object-contain` : "object-cover"}`}
          />
        )}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1c1d1a]/55 backdrop-blur-md">
          <AlertTriangle size={22} className="text-white" />
          <p className="mt-1.5 text-xs font-bold text-white">Sensitive content</p>
        </div>
        <button
          type="button"
          onClick={() => setRevealed(true)}
          aria-label="Reveal sensitive content"
          className="absolute inset-0 z-20 flex items-center justify-center"
        >
          <span className="rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-black text-[#1c1d1a] shadow-lg dark:text-white">
            Tap to view
          </span>
        </button>
      </div>
    );
  }

  if (item.type === "video") {
    return (
      <div className="relative w-full min-h-[200px]" style={{ height: single ? 'auto' : '100%' }}>
        <video
          src={item.url}
          muted={muted}
          playsInline
          autoPlay
          loop
          disablePictureInPicture
          className={`w-full ${single ? `${singleClass} object-contain` : "h-full object-cover"}`}
        />
        <button
          onClick={() => setMuted(!muted)}
          aria-label={muted ? "Unmute video" : "Mute video"}
          className="absolute bottom-2 left-2 z-50 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm transition hover:bg-black/80"
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
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
