import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Megaphone,
  Sparkles,
  ChevronDown,
  X,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  dismissUpdates,
  listenCommunityUpdates,
  relativeUpdateTime,
  type CommunityUpdate,
  type CommunityUpdateMeta,
  type CommunityUpdateType,
} from "@/services/communityUpdates";

/** Side-drawer "Updates" feed. Max 3 updates by default (8 via "View all updates"). */
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
 *   [source icon] Title                     timestamp
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
    <div className="flex min-w-0 flex-1 items-start gap-3.5">
      {/* Source identity: compact structured emblem */}
      <div aria-hidden="true" className="app-updates-source mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center text-xs">
        {meta?.emoji ? (
          meta.emoji
        ) : update.type === "announcement" ? (
          <Megaphone size={14} className={visual.iconClass} />
        ) : update.type === "issue_resolved" ? (
          <Check size={15} strokeWidth={3} className={visual.iconClass} />
        ) : (
          <span className="h-2 w-2 rounded-full bg-current opacity-75" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="min-w-0 flex-1 truncate text-xs font-black leading-tight text-[#1c1d1a] dark:text-white group-hover:text-[#3d654c] dark:group-hover:text-[#f2c14e] transition-colors">
            {update.title}
          </p>
          {timeLabel && (
            <span className="shrink-0 text-[10px] font-bold tracking-tight text-[#1c1d1a]/40 dark:text-neutral-500">
              {timeLabel}
            </span>
          )}
        </div>

        {byline && (
          <p className="mt-0.5 truncate text-[11px] font-bold tracking-wide text-[#3d654c]/85 dark:text-[#f2c14e]/85">
            {byline}
          </p>
        )}

        {update.description.trim() && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#1c1d1a]/70 dark:text-neutral-300 font-medium">
            {update.description}
          </p>
        )}

        {detailBits.length > 0 && (
          <p className="mt-1 truncate text-[11px] font-medium text-[#1c1d1a]/50 dark:text-neutral-400">
            {detailBits.join("  ·  ")}
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {meta?.status && <StatusPill status={meta.status} />}
          {isFresh && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-primary dark:bg-[#f2c14e]/20 dark:text-[#f2c14e] shadow-2xs">
              <Sparkles size={9} /> New
            </span>
          )}
        </div>
      </div>

      {/* Real media thumbnail */}
      {meta?.mediaUrl && (
        <div className="block h-15 w-16 shrink-0 overflow-hidden rounded-2xl border border-[#1c1d1a]/10 bg-[#1c1d1a]/5 shadow-xs dark:border-white/10 dark:bg-white/10">
          {meta.mediaType === "video" ? (
            <video
              src={meta.mediaUrl}
              preload="metadata"
              muted
              playsInline
              aria-label={`${mediaKindLabel} for ${update.title}`}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <img
              src={meta.mediaUrl}
              alt={`${mediaKindLabel} for ${update.title}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Restrained status pill */
function StatusPill({ status }: { status: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-[#1c1d1a]/10 bg-[#1c1d1a]/5 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#1c1d1a]/60 dark:border-white/15 dark:bg-white/10 dark:text-neutral-300">
      {status}
    </span>
  );
}

/** Subtle feed skeleton rows */
function LoadingRows() {
  return (
    <div aria-hidden="true" className="app-updates-skeleton animate-pulse">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="flex items-start gap-3.5 border-b border-[#1c1d1a]/[0.07] py-4 last:border-0 dark:border-white/[0.08]"
        >
          <div className="h-8 w-8 shrink-0 rounded-lg bg-[#1c1d1a]/10 dark:bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded-md bg-[#1c1d1a]/10 dark:bg-white/10" />
            <div className="h-3 w-1/2 rounded-md bg-[#1c1d1a]/8 dark:bg-white/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function UpdatesPanel({
  onClose,
  closeButtonRef,
  onCountChange,
}: {
  onClose?: (restoreFocus?: boolean) => void;
  closeButtonRef?: { current: HTMLButtonElement | null };
  onCountChange?: (count: number) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<{ uid: string; list: CommunityUpdate[] } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!user) return;

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
  const [freshSince] = useState(() => Date.now() - FRESH_WINDOW_MS);
  const visible = ready ? loaded.list : [];
  const shown = expanded ? visible.slice(0, EXPANDED_COUNT) : visible.slice(0, COLLAPSED_COUNT);
  const hasMore = visible.length > COLLAPSED_COUNT;

  useEffect(() => {
    if (ready) onCountChange?.(visible.length);
  }, [onCountChange, ready, visible.length]);

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
    <section aria-label="Community updates" className="app-updates-card app-updates-panel w-full">
      <div className="app-updates-heading mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="app-updates-heading-mark flex h-7 w-7 items-center justify-center rounded-lg">
            <Megaphone size={14} />
          </span>
          <h2 className="text-xs font-black uppercase tracking-widest text-[#1c1d1a]/70 dark:text-neutral-300">
            Updates
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {visible.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              disabled={dismissing}
              aria-label="Clear all updates for me"
            className="app-updates-clear rounded-lg px-2.5 py-1 text-[11px] font-black tracking-wide transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50"
            >
              Clear all
            </button>
          )}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close community updates"
            title="Close community updates"
            className="app-updates-close flex h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d654c]/40 dark:focus-visible:ring-white/30"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {!ready && <LoadingRows />}

      {ready && visible.length === 0 && (
        <div className="app-updates-empty py-8 text-center">
          <p className="text-xs font-semibold text-[#1c1d1a]/50 dark:text-neutral-500">
            You&apos;re all caught up! No new community updates.
          </p>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="app-updates-list">
          {shown.map((update) => {
            const target = update.targetUrl;
            const visual = TYPE_VISUALS[update.type];
            return (
              <li
                key={update.id}
                className="app-updates-item"
              >
                {target ? (
                  <button
                    type="button"
                    onClick={() => {
                      navigate(target);
                      onClose?.(false);
                    }}
                    aria-label={`${visual.label}: ${update.title}`}
                    className="app-updates-row group flex w-full items-start text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3d654c]/40 dark:focus-visible:ring-[#f2c14e]/50"
                  >
                    <UpdateRow update={update} freshSince={freshSince} />
                  </button>
                ) : (
                  <div
                    role="article"
                    aria-label={`${visual.label}: ${update.title}`}
                    className="app-updates-row flex w-full items-start text-left"
                  >
                    <UpdateRow update={update} freshSince={freshSince} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {ready && hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="app-updates-more mt-1 flex w-full items-center justify-between gap-2 px-1 py-3 text-xs font-black uppercase tracking-wider transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50"
        >
          <span>{expanded ? "Show less" : "View all updates"}</span>
          <ChevronDown size={14} className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}
