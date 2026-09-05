/* eslint-disable react-refresh/only-export-components -- shared media helpers are exported alongside the component on purpose */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";

export interface MediaViewerItem {
  src: string;
  mediaType?: "image" | "video" | "text" | "document" | null;
  alt?: string;
  caption?: string;
}

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".ogg"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".heic"];

/** Best-effort media type detection for legacy/URL evidence without a stored mediaType. */
export function detectMediaType(src: string | undefined | null, known?: string | null): "image" | "video" | "text" {
  if (!src) return "text";
  const normalized = (known || "").toLowerCase();
  if (normalized.startsWith("video")) return "video";
  if (normalized.startsWith("image")) return "image";
  const lower = src.toLowerCase();
  if (VIDEO_EXTENSIONS.some((ext) => lower.includes(ext))) return "video";
  if (IMAGE_EXTENSIONS.some((ext) => lower.includes(ext))) return "image";
  // Cloudinary videos often carry /video/ in the URL path.
  if (lower.includes("/video/upload/")) return "video";
  return "image";
}

/**
 * Shared fullscreen media viewer for the whole volunteering section. One
 * implementation, reused by issue media, evidence thumbs, before/after
 * comparisons and witness media.
 *
 * - Esc / background click to close, arrow keys to navigate
 * - Zoom toggle on images, native video controls
 * - Accessible dialog with focus + scroll lock
 */
export default function MediaViewer({
  items,
  index,
  onClose,
  title,
}: {
  items: MediaViewerItem[];
  index: number;
  onClose: () => void;
  title?: string;
}) {
  const [current, setCurrent] = useState(Math.max(0, Math.min(index, items.length - 1)));
  const [zoomed, setZoomed] = useState(false);
  const [failed, setFailed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const item = items[current];
  const mediaType = detectMediaType(item?.src, item?.mediaType);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const prev = useCallback(() => setCurrent((c) => (items.length > 1 ? (c - 1 + items.length) % items.length : c)), [items.length]);
  const next = useCallback(() => setCurrent((c) => (items.length > 1 ? (c + 1) % items.length : c)), [items.length]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") prev();
      else if (event.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, prev, next]);

  if (!item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title || "Media viewer"}
      className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <p className="min-w-0 truncate text-sm font-bold text-white/90">
          {title || item.caption || "Media"}
          {items.length > 1 && <span className="ml-1.5 text-xs font-semibold text-white/50">{current + 1} / {items.length}</span>}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {mediaType === "image" && (
            <button
              onClick={(event) => { event.stopPropagation(); setZoomed((z) => !z); }}
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              {zoomed ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          )}
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close media viewer"
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-2" onClick={onClose}>
        {items.length > 1 && (
          <button
            onClick={(event) => { event.stopPropagation(); prev(); }}
            aria-label="Previous media"
            className="absolute left-2 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <div className="flex max-h-full max-w-full items-center justify-center" onClick={(event) => event.stopPropagation()}>
          {mediaType === "video" ? (
            <video
              src={item.src}
              controls
              autoPlay
              playsInline
              className="max-h-full max-w-full rounded-xl"
              onError={() => setFailed(true)}
            />
          ) : mediaType === "image" ? (
            <img
              src={item.src}
              alt={item.alt || item.caption || ""}
              onError={() => setFailed(true)}
              className={`max-h-full max-w-full select-none rounded-xl object-contain transition-transform ${zoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"}`}
              onClick={(event) => { event.stopPropagation(); if (!zoomed) setZoomed(true); }}
            />
          ) : (
            <div className="max-w-md rounded-2xl bg-white p-6 text-center dark:bg-zinc-900">
              <p className="text-sm font-bold text-zinc-900 dark:text-white">Media unavailable</p>
              <p className="mt-1 break-all text-xs text-zinc-500">This record has text or a document link, not an embedded image or video.</p>
              {item.src && (
                <a
                  href={item.src}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-black"
                >
                  Open link
                </a>
              )}
            </div>
          )}
          {failed && (
            <div className="rounded-2xl bg-white p-6 text-center dark:bg-zinc-900" onClick={(event) => event.stopPropagation()}>
              <p className="text-sm font-bold text-zinc-900 dark:text-white">This media could not be loaded.</p>
              <p className="mt-1 text-xs text-zinc-500">The file may have been removed or the link may be broken.</p>
              <a href={item.src} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-black">
                Open in new tab
              </a>
            </div>
          )}
        </div>
        {items.length > 1 && (
          <button
            onClick={(event) => { event.stopPropagation(); next(); }}
            aria-label="Next media"
            className="absolute right-2 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {item.caption && (
        <div className="px-4 pb-4">
          <p className="mx-auto max-w-2xl text-center text-xs leading-5 text-white/70">{item.caption}</p>
        </div>
      )}
    </div>
  );
}
