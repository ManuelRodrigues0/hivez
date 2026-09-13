import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Megaphone, Sparkles, ChevronDown } from "lucide-react";
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
      <div
        aria-hidden="true"
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-xs shadow-2xs dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10"
      >
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
    <div aria-hidden="true" className="animate-pulse space-y-3">
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="flex items-start gap-3.5 rounded-2xl border border-[#1c1d1a]/5 bg-white/40 p-3.5 dark:border-white/5 dark:bg-[#161616]/40"
        >
          <div className="h-8 w-8 shrink-0 rounded-2xl bg-[#1c1d1a]/10 dark:bg-white/10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-3/4 rounded-md bg-[#1c1d1a]/10 dark:bg-white/10" />
            <div className="h-3 w-1/2 rounded-md bg-[#1c1d1a]/8 dark:bg-white/8" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function UpdatesPanel() {
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
    <section aria-label="Community updates" className="w-full rounded-3xl border border-[#1c1d1a]/10 bg-white/70 p-4 shadow-sm backdrop-blur-2xl dark:border-neutral-800/90 dark:bg-[#121212]/70">
      <div className="mb-3.5 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#3d654c]/10 text-[#3d654c] dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
            <Megaphone size={14} />
          </span>
          <h2 className="text-xs font-black uppercase tracking-widest text-[#1c1d1a]/70 dark:text-neutral-300">
            Updates
          </h2>
        </div>
        {visible.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={dismissing}
            aria-label="Clear all updates for me"
            className="rounded-xl px-3 py-1 text-[11px] font-black tracking-wide text-[#3d654c] transition hover:bg-[#3d654c]/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 dark:text-[#f2c14e] dark:hover:bg-[#f2c14e]/10 dark:focus-visible:ring-white/30"
          >
            Clear all
          </button>
        )}
      </div>

      {!ready && <LoadingRows />}

      {ready && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-[#1c1d1a]/10 bg-[#f7f7f2]/50 p-6 text-center dark:border-neutral-800 dark:bg-white/[0.02]">
          <p className="text-xs font-semibold text-[#1c1d1a]/50 dark:text-neutral-500">
            You&apos;re all caught up! No new community updates.
          </p>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="space-y-2.5">
          {shown.map((update) => {
            const target = update.targetUrl;
            const visual = TYPE_VISUALS[update.type];
            return (
              <li
                key={update.id}
                className="overflow-hidden rounded-2xl transition-all duration-200"
              >
                {target ? (
                  <button
                    type="button"
                    onClick={() => navigate(target)}
                    aria-label={`${visual.label}: ${update.title}`}
                    className="group flex w-full items-start rounded-2xl border border-transparent bg-[#f7f7f2]/60 p-3.5 text-left transition-all hover:border-[#3d654c]/20 hover:bg-white hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3d654c]/40 dark:border-neutral-800/40 dark:bg-white/[0.02] dark:hover:border-[#f2c14e]/30 dark:hover:bg-white/[0.06]"
                  >
                    <UpdateRow update={update} freshSince={freshSince} />
                  </button>
                ) : (
                  <div
                    role="article"
                    aria-label={`${visual.label}: ${update.title}`}
                    className="flex w-full items-start rounded-2xl border border-transparent bg-[#f7f7f2]/60 p-3.5 text-left dark:border-neutral-800/40 dark:bg-white/[0.02]"
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
          className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1c1d1a]/5 px-4 py-2.5 text-center text-xs font-black uppercase tracking-wider text-[#1c1d1a]/70 transition-all hover:bg-[#1c1d1a]/10 hover:text-[#1c1d1a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/50 dark:bg-white/5 dark:text-neutral-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/30"
        >
          <span>{expanded ? "Show less" : "View all updates"}</span>
          <ChevronDown size={14} className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}