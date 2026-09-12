import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Megaphone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  dismissUpdates,
  listenCommunityUpdates,
  relativeUpdateTime,
  type CommunityUpdate,
  type CommunityUpdateMeta,
  type CommunityUpdateType,
} from "@/services/communityUpdates";

/** Right-rail "Updates" feed. Max 3 updates by default (8 via "View all updates"). */
const COLLAPSED_COUNT = 3;
const EXPANDED_COUNT = 8;

/** Steady "new" marker: updates newer than this count as fresh (never jumps on re-render). */
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

interface TypeVisual {
  /** Readable type label (accessible labels — never the only cue). */
  label: string;
  /** Subtle source-icon color; icons stay 12px so the row reads as text, not badges. */
  iconClass: string;
}

const TYPE_VISUALS: Record<CommunityUpdateType, TypeVisual> = {
  volunteering: { label: "Volunteer action", iconClass: "text-amber-600 dark:text-[#f2c14e]" },
  event: { label: "Upcoming event", iconClass: "text-amber-600 dark:text-[#f2c14e]" },
  issue_resolved: { label: "Issue resolved", iconClass: "text-emerald-600 dark:text-emerald-400" },
  announcement: { label: "Announcement", iconClass: "text-orange-600 dark:text-orange-400" },
  system: { label: "System update", iconClass: "text-zinc-500 dark:text-neutral-400" },
};

/**
 * One compact feed row:
 *   [source icon] Title                    timestamp
 *                 source · organizer
 *                 description (max 2 lines)
 *                 event-time / counts (real values only)
 *                 [optional thumbnail on the right]
 */
function UpdateRow({ update, freshSince }: { update: CommunityUpdate; freshSince: number }) {
  const meta: CommunityUpdateMeta | null = update.meta ?? null;
  const visual = TYPE_VISUALS[update.type];
  const timeLabel = relativeUpdateTime(update.timestamp);
  const eventLabel = update.eventDate?.label?.trim() || null;

  const byline = [meta?.source, meta?.organizer].filter(Boolean).join(" · ");

  const statContext = (() => {
    const stat = (meta?.stat ?? "").trim();
    const context = (meta?.context ?? "").trim();
    if (stat && context && context !== update.description.trim() && !stat.includes(context)) {
      return `${stat} · ${context}`;
    }
    return stat || context || "";
  })();
  const detailBits = [eventLabel, statContext, update.type === "announcement" ? null : meta?.detail]
    .map((bit) => (bit ?? "").trim())
    .filter(Boolean);

  const mediaKindLabel = meta?.mediaType === "video" ? "video" : "photo";
  const isFresh = (() => {
    if (update.eventDate) return false;
    const value = update.timestamp as unknown;
    let ms = 0;
    if (value instanceof Date) ms = value.getTime();
    else if (typeof value === "number") ms = value;
    else if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
      try {
        ms = ((value as { toDate: () => Date }).toDate()).getTime();
      } catch {
        ms = 0;
      }
    }
    return ms > 0 && ms >= freshSince;
  })();

  return (
    <span className="flex min-w-0 flex-1 items-start gap-2.5">
      {/* Source identity: small icon (action-type emoji or Lucide glyph). Never a big image. */}
      <span
        aria-hidden="true"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1c1d1a]/5 text-[13px] leading-none dark:bg-white/10"
      >
        {meta?.emoji ? (
          meta.emoji
        ) : update.type === "announcement" ? (
          <Megaphone size={12} className={visual.iconClass} />
        ) : update.type === "issue_resolved" ? (
          <Check size={13} strokeWidth={3} className={visual.iconClass} />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-[#1c1d1a] dark:text-white">
            {update.title}
          </span>
          {timeLabel && (
            <span className="shrink-0 text-[11px] leading-5 text-[#1c1d1a]/50 dark:text-neutral-500">
              {timeLabel}
            </span>
          )}
        </span>

        {byline && (
          <span className="mt-px block truncate text-[11px] leading-4 text-[#1c1d1a]/55 dark:text-neutral-500">
            {byline}
          </span>
        )}

        {update.description.trim() && (
          <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-[1.35] text-[#1c1d1a]/75 dark:text-neutral-400">
            {update.description}
          </span>
        )}

        {detailBits.length > 0 && (
          <span className="mt-0.5 block truncate text-[11px] leading-4 text-[#1c1d1a]/55 dark:text-neutral-500">
            {detailBits.join("  ·  ")}
          </span>
        )}

        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {meta?.status && <StatusPill status={meta.status} />}
          {isFresh && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-[#3d654c]/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-[#3d654c] dark:bg-[#f2c14e]/15 dark:text-[#f2c14e]">
              New
            </span>
          )}
        </span>
      </span>

      {/* Real media only: issue photo/video thumbnail on the right. Never a placeholder. */}
      {meta?.mediaUrl && (
        <span className="block h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-[#1c1d1a]/5 dark:bg-white/10">
          {meta.mediaType === "video" ? (
            <video
              src={meta.mediaUrl}
              preload="metadata"
              muted
              playsInline
              aria-label={`${mediaKindLabel} for ${update.title}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <img
              src={meta.mediaUrl}
              alt={`${mediaKindLabel} for ${update.title}`}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
        </span>
      )}
    </span>
  );
}

/** Restrained status pill (Urgent / Upcoming / Active / Resolved / Verified / Announcement). */
function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-[#1c1d1a]/10 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-[#1c1d1a]/55 dark:border-white/10 dark:text-neutral-400">
      {status}
    </span>
  );
}

/** Subtle feed skeleton rows — no blank card, no layout shift while loading. */
function LoadingRows() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="flex items-start gap-2.5 border-b border-[#1c1d1a]/8 px-1.5 py-2.5 last:border-b-0 dark:border-white/10"
        >
          <div className="h-6 w-6 shrink-0 rounded-full bg-[#1c1d1a]/10 dark:bg-white/10" />
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-3/4 rounded bg-[#1c1d1a]/10 dark:bg-white/10" />
            <div className="mt-1.5 h-3 w-1/2 rounded bg-[#1c1d1a]/8 dark:bg-white/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function UpdatesPanel() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Keyed to the user so switching accounts never leaks another user's list.
  const [loaded, setLoaded] = useState<{ uid: string; list: CommunityUpdate[] } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Definitive end to the skeleton: if no source has emitted within a few
    // seconds (e.g. a listener is denied or a source stalls), resolve with an
    // empty list. Live sources still replace it the moment they emit.
    const fallbackTimer = window.setTimeout(() => {
      setLoaded((current) =>
        current && current.uid === user.uid ? current : { uid: user.uid, list: [] }
      );
    }, 6000);

    const unsubscribe = listenCommunityUpdates(user.uid, (next) => {
      window.clearTimeout(fallbackTimer);
      setLoaded({ uid: user.uid, list: next });
    });

    return () => {
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [user]);

  const ready = loaded !== null && loaded.uid === user?.uid;
  // Snapshot "now" once per list so "New" markers never jump while reading.
  const [freshSince] = useState(() => Date.now() - FRESH_WINDOW_MS);
  const visible = ready ? loaded.list : [];
  const shown = expanded ? visible.slice(0, EXPANDED_COUNT) : visible.slice(0, COLLAPSED_COUNT);
  const hasMore = visible.length > COLLAPSED_COUNT;

  async function handleClear() {
    if (!user || visible.length === 0 || dismissing) return;
    setDismissing(true);
    try {
      await dismissUpdates(user.uid, visible.map((update) => update.id));
      setExpanded(false);
    } catch (error) {
      console.error("Failed to clear updates:", error);
    } finally {
      setDismissing(false);
    }
  }

  return (
    <section aria-label="Community updates" className="px-1 py-1">
      {/* Section header (not a card header): compact, strong, minimal spacing. */}
      <div className="mb-1 flex items-center justify-between px-1.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#1c1d1a]/60 dark:text-neutral-400">
          Updates
        </h2>
        {visible.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={dismissing}
            aria-label="Clear all updates for me"
            className="rounded px-1 py-0.5 text-[11px] font-bold text-[#3d654c] transition hover:opacity-80 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 dark:text-[#f2c14e] dark:focus-visible:ring-white/30"
          >
            Clear
          </button>
        )}
      </div>

      {!ready && <LoadingRows />}

      {ready && visible.length === 0 && (
        <p className="px-1.5 py-2 text-[12px] leading-5 text-[#1c1d1a]/50 dark:text-neutral-500">
          You&apos;re all caught up
        </p>
      )}

      {shown.length > 0 && (
        <ul>
          {shown.map((update) => {
            const target = update.targetUrl;
            const visual = TYPE_VISUALS[update.type];
            return (
              <li
                key={update.id}
                className="border-b border-[#1c1d1a]/8 last:border-b-0 dark:border-white/10"
              >
                {target ? (
                  <button
                    type="button"
                    onClick={() => navigate(target)}
                    aria-label={`${visual.label}: ${update.title}`}
                    className="group flex w-full items-start rounded-lg px-1.5 py-2.5 text-left transition hover:bg-[#1c1d1a]/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 dark:hover:bg-white/[0.04] dark:focus-visible:ring-white/30"
                  >
                    <UpdateRow update={update} freshSince={freshSince} />
                  </button>
                ) : (
                  <div
                    role="article"
                    aria-label={`${visual.label}: ${update.title}`}
                    className="flex w-full items-start px-1.5 py-2.5 text-left"
                  >
                    <UpdateRow update={update} freshSince={freshSince} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Simple textual control: "View all updates →" ↔ "Show less". */}
      {ready && hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="mt-1 w-full rounded px-1.5 py-1.5 text-center text-[12px] font-semibold text-[#1c1d1a]/60 transition hover:text-[#1c1d1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 dark:text-neutral-400 dark:hover:text-white dark:focus-visible:ring-white/30"
        >
          {expanded ? "Show less" : "View all updates →"}
        </button>
      )}
    </section>
  );
}