/* eslint-disable react-refresh/only-export-components -- shared evidence helpers are exported alongside the component on purpose */

import { useMemo, useState } from "react";
import { Camera, FileText, Image as ImageIcon, MapPin, PlayCircle } from "lucide-react";
import MediaViewer, { detectMediaType, type MediaViewerItem } from "@/components/volunteering/MediaViewer";
import { useLiveProfile } from "@/hooks/useLiveProfile";
import type { ActivityEvidence, VolunteerActivity } from "@/types/volunteering";
import { evidenceKindLabel, evidenceTypeLabel, relativeTimeText } from "@/utils/volunteering";

type EvidenceFilter =
  | "all"
  | "before"
  | "after"
  | "report"
  | "video"
  | "supporting"
  | "pending"
  | "accepted"
  | "rejected";

const FILTERS: { key: EvidenceFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "before", label: "Before" },
  { key: "after", label: "After" },
  { key: "report", label: "Report" },
  { key: "video", label: "Video" },
  { key: "supporting", label: "Supporting" },
  { key: "pending", label: "Pending review" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
];

const statusPill: Record<string, string> = {
  SUBMITTED: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  REVIEWED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300",
  ACCEPTED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
};

function statusLabel(status: string) {
  return status === "SUBMITTED" ? "Pending review" : status.replaceAll("_", " ").toLowerCase();
}

export function evidenceMediaSource(item: ActivityEvidence): { url: string | null; mediaType: "image" | "video" | "text" } {
  const url = item.beforeMediaUrl || item.mediaUrl || item.afterMediaUrl;
  if (!url) return { url: null, mediaType: "text" };
  return { url, mediaType: detectMediaType(url, item.mediaType) };
}

/**
 * Clean evidence gallery: grid of individual, attributable evidence items
 * with type labels, live submitter profile, status and a shared media viewer.
 * Multiple evidence submissions per action and per community are preserved.
 */
export default function EvidenceGallery({
  items,
  activities,
  canManage,
  onReview,
}: {
  items: ActivityEvidence[];
  activities: VolunteerActivity[];
  canManage: boolean;
  onReview?: (item: ActivityEvidence, status: ActivityEvidence["status"]) => void;
}) {
  const [filter, setFilter] = useState<EvidenceFilter>("all");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const activityById = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);

  const filtered = useMemo(() => {
    return items
      .slice()
      .sort((a, b) => (b.createdAt?.toDate?.().getTime?.() || 0) - (a.createdAt?.toDate?.().getTime?.() || 0))
      .filter((item) => {
        const source = evidenceMediaSource(item);
        switch (filter) {
          case "before":
            return item.kind === "BEFORE" || item.evidenceType === "BEFORE" || Boolean(item.beforeMediaUrl);
          case "after":
            return item.kind === "AFTER" || item.evidenceType === "AFTER" || Boolean(item.afterMediaUrl);
          case "report":
            return item.evidenceType === "REPORT" || item.kind === "REPORT";
          case "video":
            return source.mediaType === "video";
          case "supporting":
            return !["BEFORE", "AFTER", "REPORT"].includes(item.kind || "") && item.evidenceType !== "REPORT";
          case "pending":
            return item.status === "SUBMITTED";
          case "accepted":
            return item.status === "ACCEPTED";
          case "rejected":
            return item.status === "REJECTED";
          default:
            return true;
        }
      });
  }, [items, filter]);

  const viewerItems: MediaViewerItem[] = useMemo(
    () =>
      filtered.map((item) => {
        const source = evidenceMediaSource(item);
        const action = activityById.get(item.activityId);
        return {
          src: source.url || "",
          mediaType: source.mediaType,
          caption: `${item.user.displayName} · ${evidenceTypeLabel(item.evidenceType, Boolean(item.kind))}${action ? ` · ${action.title}` : ""}\n${item.description}`,
        };
      }),
    [filtered, activityById]
  );

  return (
    <section className="space-y-4">
      {/* Filter chips */}
      {items.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = f.key === "all" ? items.length : 0;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`h-9 shrink-0 rounded-full px-3 text-xs font-bold transition ${filter === f.key ? "bg-zinc-950 text-white dark:bg-white dark:text-black" : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"}`}
              >
                {f.label}
                {count > 0 && f.key === "all" && <span className="ml-1 opacity-60">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item, index) => {
            const source = evidenceMediaSource(item);
            const action = activityById.get(item.activityId);
            return <EvidenceCard key={item.id} item={item} source={source} action={action} canManage={canManage} onReview={onReview} onOpen={() => setViewerIndex(index)} />;
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-800">
          <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
            {items.length === 0 ? "No evidence submitted yet." : `No ${filter === "all" ? "" : `${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} `}evidence right now.`}
          </p>
          {items.length === 0 && <p className="mt-1 text-xs font-semibold text-zinc-500">Join an action and submit photos, videos or reports to help verify the issue.</p>}
        </div>
      )}

      {viewerIndex !== null && viewerItems.length > 0 && (
        <MediaViewer items={viewerItems} index={viewerIndex} onClose={() => setViewerIndex(null)} title="Evidence" />
      )}
    </section>
  );
}

function EvidenceCard({
  item,
  source,
  action,
  canManage,
  onReview,
  onOpen,
}: {
  item: ActivityEvidence;
  source: { url: string | null; mediaType: "image" | "video" | "text" };
  action?: VolunteerActivity;
  canManage: boolean;
  onReview?: (item: ActivityEvidence, status: ActivityEvidence["status"]) => void;
  onOpen: () => void;
}) {
  const liveUser = useLiveProfile(item.uid, item.user) || item.user;
  const typeLabel = item.evidenceType ? evidenceTypeLabel(item.evidenceType) : evidenceKindLabel(item.kind);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700">
      {/* Media thumbnail */}
      <button
        onClick={onOpen}
        className="relative block aspect-video w-full overflow-hidden bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-900"
        aria-label={`Open evidence: ${typeLabel}${item.description ? ` - ${item.description}` : ""}`}
      >
        {source.url && source.mediaType === "video" ? (
          <video src={source.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : source.url ? (
          <img src={source.url} alt={item.description || typeLabel} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-zinc-400">
            <FileText size={28} />
          </span>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
          {source.mediaType === "video" ? <PlayCircle size={12} /> : source.mediaType === "image" ? <ImageIcon size={12} /> : <Camera size={12} />}
          {typeLabel}
        </span>
        {item.locationLabel && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            <MapPin size={11} /> {item.locationLabel}
          </span>
        )}
      </button>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <img
            src={liveUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(liveUser.displayName || item.user.displayName)}&background=111&color=fff`}
            alt=""
            className="h-6 w-6 rounded-full object-cover"
          />
          <p className="min-w-0 flex-1 truncate text-xs font-black text-zinc-900 dark:text-white">{liveUser.displayName || item.user.displayName}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusPill[item.status] || statusPill.SUBMITTED}`}>{statusLabel(item.status)}</span>
        </div>

        {action && (
          <p className="truncate text-[11px] font-semibold text-zinc-500">
            Action: <span className="text-zinc-700 dark:text-zinc-300">{action.title}</span>
          </p>
        )}

        {item.description && <p className="line-clamp-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">{item.description}</p>}

        <p className="mt-auto text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{relativeTimeText(item.createdAt)}</p>

        {canManage && onReview && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {(["REVIEWED", "ACCEPTED", "REJECTED"] as ActivityEvidence["status"][]).map((status) => (
              <button
                key={status}
                onClick={() => onReview(item, status)}
                className={`h-8 rounded-full border px-3 text-[11px] font-bold transition hover:bg-zinc-50 dark:hover:bg-zinc-900 ${item.status === status ? "border-zinc-950 bg-zinc-950 text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-200 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"}`}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
