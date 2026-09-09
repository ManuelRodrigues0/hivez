import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Check, HandHeart, Megaphone, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  dismissUpdates,
  listenCommunityUpdates,
  relativeUpdateTime,
  type CommunityUpdate,
  type CommunityUpdateType,
} from "@/services/communityUpdates";

/** Right-rail "Updates" panel. Max 3 updates by default (8 via "View all"). */
const COLLAPSED_COUNT = 3;
const EXPANDED_COUNT = 8;

interface TypeVisual {
  /** Readable type label (accessible labels — never the only cue). */
  label: string;
  dotClass: string;
  iconClass: string;
}

const TYPE_VISUALS: Record<CommunityUpdateType, TypeVisual> = {
  volunteering: {
    label: "Volunteering",
    dotClass: "bg-amber-500 dark:bg-[#f2c14e]",
    iconClass: "text-amber-600 dark:text-[#f2c14e]",
  },
  event: {
    label: "Upcoming event",
    dotClass: "bg-amber-500 dark:bg-[#f2c14e]",
    iconClass: "text-amber-600 dark:text-[#f2c14e]",
  },
  issue_resolved: {
    label: "Resolved issue",
    dotClass: "bg-emerald-500 dark:bg-emerald-500",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  announcement: {
    label: "Community announcement",
    dotClass: "bg-orange-500 dark:bg-orange-400",
    iconClass: "text-orange-600 dark:text-orange-400",
  },
  system: {
    label: "System update",
    dotClass: "bg-zinc-400 dark:bg-neutral-500",
    iconClass: "text-zinc-500 dark:text-neutral-400",
  },
};

const TYPE_ICONS = {
  volunteering: HandHeart,
  event: CalendarDays,
  issue_resolved: Check,
  announcement: Megaphone,
  system: Sparkles,
} as const;

function UpdateBody({ update }: { update: CommunityUpdate }) {
  const visual = TYPE_VISUALS[update.type];
  const Icon = TYPE_ICONS[update.type];
  return (
    <div>
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${visual.dotClass}`} />
        <Icon size={12} aria-hidden="true" className={`shrink-0 ${visual.iconClass}`} />
        <p className="truncate text-sm font-semibold text-[#1c1d1a] dark:text-white">{update.title}</p>
      </div>
      {update.description && (
        <p className="mt-0.5 truncate text-[13px] leading-5 text-[#1c1d1a]/70 dark:text-neutral-400">
          {update.description}
        </p>
      )}
      <p className="mt-0.5 text-[11px] text-[#1c1d1a]/50 dark:text-neutral-500">
        {relativeUpdateTime(update.timestamp)}
      </p>
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
    return listenCommunityUpdates(user.uid, (next) => {
      setLoaded({ uid: user.uid, list: next });
    });
  }, [user]);

  const ready = loaded !== null && loaded.uid === user?.uid;
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
    <div className="app-updates-card rounded-2xl border border-[#1c1d1a]/10 bg-white p-4 dark:border-neutral-800 dark:bg-[#121212]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#1c1d1a]/60 dark:text-neutral-400">
          Updates
        </h2>
        {visible.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            disabled={dismissing}
            className="text-xs font-bold text-[#3d654c] transition hover:opacity-80 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-neutral-400/50 dark:text-[#f2c14e]"
          >
            Clear
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        ready && (
          <p className="py-5 text-center text-[11px] leading-5 text-[#1c1d1a]/50 dark:text-neutral-500">
            You&apos;re all caught up
          </p>
        )
      ) : (
        <ul className="space-y-4">
          {shown.map((update) => {
            const target = update.targetUrl;
            const visual = TYPE_VISUALS[update.type];
            return (
              <li key={update.id}>
                {target ? (
                  <button
                    type="button"
                    onClick={() => navigate(target)}
                    aria-label={`${visual.label}: ${update.title}`}
                    className="block w-full rounded-xl p-2 text-left transition hover:bg-[#1c1d1a]/5 focus-visible:ring-2 focus-visible:ring-neutral-400/50 dark:hover:bg-white/5"
                  >
                    <UpdateBody update={update} />
                  </button>
                ) : (
                  <div className="block w-full rounded-xl p-2 text-left">
                    <UpdateBody update={update} />
                  </div>
                )}
              </li>
            );
          })}

          {hasMore && (
            <li>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                className="mx-auto flex items-center gap-1 text-[11px] font-bold text-[#3d654c]/80 transition hover:opacity-80 focus-visible:ring-2 focus-visible:ring-neutral-400/50 dark:text-neutral-400 dark:focus-visible:ring-white/30"
              >
                <span>{expanded ? "Show less" : "View all"}</span>
                <span className="text-[10px] font-semibold text-[#1c1d1a]/40 dark:text-neutral-500">
                  ({visible.length})
                </span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}