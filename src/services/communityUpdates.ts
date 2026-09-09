/**
 * Community Updates adapter — powers the right-rail "Updates" panel.
 *
 * It consumes EXISTING Hivez data only (nothing is fabricated):
 *   - `broadcasts`          -> IMPORTANT COMMUNITY ANNOUNCEMENTS
 *   - `issueCommunities`    -> recently RESOLVED / VERIFIED issues
 *   - `volunteerActivities` -> upcoming volunteering sessions & community events
 *
 * System updates are intentionally NOT invented here: no real system-update
 * source exists yet, so the panel never shows fake content. Future admin
 * announcements can flow through the existing broadcast mechanism.
 *
 * UPDATE MODEL (stable, admin-friendly contract):
 *   { id, type, title, description, timestamp, eventDate, priority, targetUrl, meta }
 * `id` is a stable dedupe key also used for per-user dismissal. `meta` holds
 * real per-type display data (action-type identity, counts, media) — the panel
 * hides anything absent, so nothing is ever fabricated.
 */
import {
  arrayUnion,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";
import type { IssueCommunity, VolunteerActivity } from "@/types/volunteering";
import { activityScheduleState } from "@/utils/volunteering";
import { actionTypeSummary, getActionType } from "@/utils/actionTypes";
import { listenAllVolunteerActivities, listenOpenIssueCommunities } from "@/services/volunteering";
export type CommunityUpdateType =
  | "volunteering" // open volunteer session (no fixed schedule yet)
  | "event" // scheduled community event (volunteer activity with a date)
  | "issue_resolved" // a community issue was marked resolved
  | "announcement" // important community announcement (admin broadcast)
  | "system"; // reserved for real system notices (no source yet)

export type UpdatePriority = "high" | "medium" | "low";

/**
 * Optional, additive per-update display metadata for the feed-style panel.
 * Every value comes from a real existing record — the UI hides anything that
 * is not present, so nothing is ever fabricated in the sidebar.
 */
export interface CommunityUpdateMeta {
  /** Recognizable source identity (action-type label, "Announcement", "Issue resolved"). */
  source: string;
  /** Real organizer / admin / owner display name, when known. */
  organizer?: string | null;
  /** Primary place/context: real location or an action-type field value. */
  context?: string | null;
  /** Real supporting counts ("8 / 15 volunteers", "4 actions"). */
  stat?: string | null;
  /** One real type-specific detail ("Authority: Municipal Corp"). */
  detail?: string | null;
  /** Restrained status ("Urgent" | "Upcoming" | "Active" | "Resolved" | "Verified" | "Announcement"). */
  status?: string | null;
  /** Action-type emoji from the existing catalog (volunteering source identity). */
  emoji?: string | null;
  /** Real media thumbnail (issue media only — never a placeholder). */
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
}

export interface CommunityUpdate {
  /** Stable dedupe + dismissal key: "activity:<id>", "issue:<id>", "broadcast:<id>". */
  id: string;
  type: CommunityUpdateType;
  title: string;
  /** One-line summary of the underlying record (never fabricated). */
  description: string;
  /** When the update happened (Firestore-style timestamp). */
  timestamp: { toDate?: () => Date } | Date | null;
  /** Present for scheduled events/volunteering; used for ranking + display. */
  eventDate: { startMs: number; label: string } | null;
  priority: UpdatePriority;
  targetUrl: string | null;
  /** Type-specific real metadata (source identity, counts, status, media). */
  meta?: CommunityUpdateMeta | null;
}

interface BroadcastDoc {
  id: string;
  title?: string;
  body?: string;
  adminName?: string;
  createdAt?: { toDate?: () => Date } | Date | null;
}
// =====================================================================
// Time helpers (small, deterministic; no matching exported util exists)
// =====================================================================

const MINUTE = 60_000;
const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toMillis(value: { toDate?: () => Date } | Date | number | null | undefined): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  return 0;
}

/** Safely trim optional real values; missing info stays missing (never fabricated). */
function cleanText(value: string | null | undefined): string {
  return (value || "").trim();
}

function startOfDayMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatTime(hhmm: string | null | undefined): string {
  const [rawHour = "", min = "00"] = (hhmm || "").split(":");
  const hour = Number(rawHour);
  if (!Number.isFinite(hour)) return (hhmm || "9:00 AM").trim();
  const suffix = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${min} ${suffix}`;
}

function parseSchedule(dateKey: string, timeKey: string | null | undefined): number {
  const ms = new Date(`${dateKey}T${timeKey || "09:00"}:00`).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}
/**
 * Relative timestamps: "Just now", "5m ago", "2h ago", "Yesterday", "2d ago",
 * then "Sep 5" / "Sep 5, 2026". Used for non-event updates.
 */
export function relativeUpdateTime(value: { toDate?: () => Date } | Date | number | null | undefined): string {
  const ms = toMillis(value);
  if (!ms) return "";
  const date = new Date(ms);
  const now = new Date();
  const diffMs = now.getTime() - ms;
  if (diffMs < MINUTE) return "Just now";

  const minutes = Math.floor(diffMs / MINUTE);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  const todayStart = startOfDayMs(now);
  const dayStart = startOfDayMs(date);
  if (dayStart === todayStart) return `${hours}h ago`;

  const dayDiff = Math.round((todayStart - dayStart) / DAY);
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff}d ago`;

  const sameYear = now.getFullYear() === date.getFullYear();
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Event timestamp line: "Today · 9:00 AM", "Tomorrow · 9:00 AM",
 * "Saturday · 4:00 PM", "Sep 12 · 9:00 AM" or "Sep 12, 2027 · 9:00 AM".
 */
export function formatEventDate(
  dateKey: string,
  timeKey: string | null | undefined,
  now: Date = new Date()
): string {
  const start = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(start.getTime())) return dateKey || "Upcoming";
  const dayDiff = Math.round((startOfDayMs(start) - startOfDayMs(now)) / DAY);
  const time = formatTime(timeKey);
  if (dayDiff === 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Tomorrow · ${time}`;
  if (dayDiff > 1 && dayDiff <= 6) return `${WEEKDAYS[start.getDay()]} · ${time}`;
  const sameYear = now.getFullYear() === start.getFullYear();
  const dateText = sameYear
    ? `${MONTHS[start.getMonth()]} ${start.getDate()}`
    : `${MONTHS[start.getMonth()]} ${start.getDate()}, ${start.getFullYear()}`;
  return `${dateText} · ${time}`;
}
// =====================================================================
// Priority scoring (simple, deterministic; never exposed to the user)
// =====================================================================

/** Urgent categories mirror the feed-ranking logic in @/services/feedRanking. */
const URGENT_CATEGORIES = new Set(["electric-hazards", "blood-requests", "missing-persons", "fallen-trees"]);

const EMERGENCY_ANNOUNCEMENT_PATTERN =
  /\b(emergency|urgent|safety|cancel(led|lations)?|suspend(ed)?|closure|closed|water supply|power cut|gas leak|flood(ing)?|fire|hazard(ous)?|missing|evacuat|accident|contaminat)\b/i;

function announcementPriority(title: string, body: string): UpdatePriority {
  return EMERGENCY_ANNOUNCEMENT_PATTERN.test(`${title} ${body}`) ? "high" : "medium";
}

function issuePriority(community: IssueCommunity): UpdatePriority {
  return URGENT_CATEGORIES.has(community.category) ? "high" : "medium";
}

function activityPriority(activity: VolunteerActivity, nowMs: number): UpdatePriority {
  if (activity.urgent) return "high";
  const startMs = activity.startDate ? parseSchedule(activity.startDate, activity.startTime) : 0;
  if (startMs > 0 && startMs - nowMs <= 3 * DAY) return "high"; // happening very soon
  return "medium";
}
// =====================================================================
// Adapters: raw records -> CommunityUpdate
// =====================================================================

function fromBroadcast(broadcast: BroadcastDoc): CommunityUpdate {
  const title = (broadcast.title || "Community Notice").trim();
  const body = (broadcast.body || "").trim();
  return {
    id: `broadcast:${broadcast.id}`,
    type: "announcement",
    title,
    description: body,
    timestamp: broadcast.createdAt || null,
    eventDate: null,
    priority: announcementPriority(title, body),
    targetUrl: "/notifications",
    meta: {
      source: "Announcement",
      organizer: cleanText(broadcast.adminName) || null,
      status: "Announcement",
    },
  };
}

/**
 * Real media thumbnail: only issue media that actually exists. Community
 * updates today only expose `mediaUrl` on the issue record, so we never
 * attach participant photos or fabricated placeholders here.
 */
function issueMedia(community: IssueCommunity): Pick<CommunityUpdateMeta, "mediaUrl" | "mediaType"> {
  const url = cleanText(community.mediaUrl);
  if (!url) return { mediaUrl: null, mediaType: null };
  const kind = cleanText(community.mediaType).toLowerCase();
  if (kind.includes("video")) return { mediaUrl: url, mediaType: "video" as const };
  return { mediaUrl: url, mediaType: "image" as const };
}

function fromResolvedIssue(community: IssueCommunity): CommunityUpdate {
  const location = cleanText(community.location);
  const actionCount =
    typeof community.activityCount === "number" && community.activityCount > 0
      ? `${community.activityCount} action${community.activityCount === 1 ? "" : "s"}`
      : null;
  return {
    id: `issue:${community.id}`,
    type: "issue_resolved",
    title: community.title || "Community issue",
    description: location || cleanText(community.category) || "The issue has been resolved",
    timestamp: community.updatedAt || community.createdAt || null,
    eventDate: null,
    priority: issuePriority(community),
    targetUrl: `/issue-community/${community.id}`,
    meta: {
      source: "Issue resolved",
      context: location || cleanText(community.category) || null,
      stat: actionCount,
      status: community.status === "VERIFIED" ? "Verified" : "Resolved",
      ...issueMedia(community),
    },
  };
}

/**
 * Volunteering/action-type metadata: the panel reuses the existing
 * `actionTypes.ts` catalog (`getActionType`) plus the card-level
 * `actionTypeSummary` rows, so each type displays its own relevant detail
 * (authority name, reference number, search area, evidence requested...).
 * Missing values are hidden, never guessed.
 */
function activityMeta(
  activity: VolunteerActivity,
  scheduled: boolean
): CommunityUpdateMeta {
  const catalog = getActionType(activity.actionType);
  const location = cleanText(activity.location);
  const summary = actionTypeSummary({
    actionType: activity.actionType ?? null,
    typeDetails: activity.typeDetails ?? null,
  });
  const firstRow = summary.length > 0 ? summary[0] : null;

  const count = Number(activity.volunteerCount) || 0;
  const limit = Number(activity.volunteerLimit) || 0;
  const stat =
    count > 0 && limit > 0
      ? `${count} / ${limit} volunteers`
      : count > 0
        ? `${count} volunteer${count === 1 ? "" : "s"}`
        : limit > 0
          ? `${limit} volunteers needed`
          : null;

  const organizer =
    cleanText(activity.organizer?.displayName) ||
    cleanText(activity.organizer?.username) ||
    null;

  const status = activity.urgent
    ? "Urgent"
    : scheduled
      ? "Upcoming"
      : activity.status === "OPEN" || activity.status === "ACTIVE"
        ? "Active"
        : null;

  return {
    source: catalog?.label || "Volunteer action",
    organizer,
    context: location || null,
    stat,
    detail: firstRow ? `${firstRow.label}: ${firstRow.value}` : null,
    status,
    emoji: catalog?.emoji || null,
  };
}

function fromActivity(activity: VolunteerActivity): CommunityUpdate {
  const startMs = activity.startDate ? parseSchedule(activity.startDate, activity.startTime) : 0;
  const scheduled = startMs > 0;
  const locationText = cleanText(activity.location);
  const title = activity.title?.trim() || "Volunteer session";
  const description = locationText || "Volunteer session";
  return {
    id: `activity:${activity.id}`,
    type: scheduled ? "event" : "volunteering",
    title,
    description,
    timestamp: activity.createdAt || activity.updatedAt || null,
    eventDate: scheduled
      ? { startMs, label: formatEventDate(activity.startDate, activity.startTime) }
      : null,
    priority: activityPriority(activity, Date.now()),
    targetUrl: `/issue-community/${activity.communityId}`,
    meta: activityMeta(activity, scheduled),
  };
}
// =====================================================================
// Ranking + merge
// =====================================================================

const PRIORITY_RANK: Record<UpdatePriority, number> = { high: 3, medium: 2, low: 1 };
const CLOSED_ACTIVITY_STATUSES = new Set(["CANCELLED", "COMPLETED", "VERIFIED"]);
const RESOLVED_ISSUE_STATUSES = new Set(["RESOLVED", "VERIFIED"]);

const MAX_CANDIDATES_PER_SOURCE = 25;
const MAX_OUTPUT = 12;

function rankUpdates(updates: CommunityUpdate[]): CommunityUpdate[] {
  return [...updates].sort((a, b) => {
    const priorityDelta = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
    if (priorityDelta !== 0) return priorityDelta;
    const aStart = a.eventDate?.startMs || 0;
    const bStart = b.eventDate?.startMs || 0;
    if (aStart > 0 && bStart > 0) return aStart - bStart; // soonest event first
    if (aStart > 0) return -1; // upcoming events rank above general news
    if (bStart > 0) return 1;
    return toMillis(b.timestamp) - toMillis(a.timestamp); // newest first
  });
}

function buildUpdates(
  broadcasts: BroadcastDoc[],
  communities: IssueCommunity[],
  activities: VolunteerActivity[],
  dismissed: Set<string>
): CommunityUpdate[] {
  const nowMs = Date.now();

  const resolved = communities
    .filter((community) => RESOLVED_ISSUE_STATUSES.has(community.status) && !community.archived)
    .slice(0, MAX_CANDIDATES_PER_SOURCE)
    .map(fromResolvedIssue);

  const upcoming = activities
    .filter(
      (activity) =>
        !CLOSED_ACTIVITY_STATUSES.has(activity.status) && activityScheduleState(activity, nowMs) !== "OVER"
    )
    .slice(0, MAX_CANDIDATES_PER_SOURCE)
    .map(fromActivity);

  const updates = [
    ...broadcasts.slice(0, 8).map(fromBroadcast),
    ...resolved,
    ...upcoming,
  ].filter((update) => !dismissed.has(update.id));

  const ranked = rankUpdates(updates);
  return ranked.slice(0, MAX_OUTPUT);
}
// =====================================================================
// Dismissal persistence (per user, under users/<uid> like pushTokens).
// "Clear" only hides updates for THIS user — it never deletes community data.
// =====================================================================

function dismissalDocRef(uid: string) {
  return doc(db, "users", uid, "updateDismissals", "state");
}

/** Dismisses updates for the current user by stable update id. */
export async function dismissUpdates(uid: string, keys: string[]): Promise<void> {
  if (!uid || keys.length === 0) return;
  await setDoc(dismissalDocRef(uid), { dismissedKeys: arrayUnion(...keys) }, { merge: true });
}

function listenDismissedUpdateKeys(uid: string, onNext: (keys: Set<string>) => void) {
  return onSnapshot(dismissalDocRef(uid), (snapshot) => {
    const data = snapshot.data() as { dismissedKeys?: string[] } | undefined;
    onNext(new Set(data?.dismissedKeys || []));
  });
}
// =====================================================================
// Orchestrator: real-time, reuses existing Hivez listeners.
// New events, announcements and resolutions surface as soon as they are
// written through the existing systems — no polling infrastructure needed.
// =====================================================================

/**
 * Subscribes to the three community data sources plus the user's dismissal
 * set, and pushes a ranked, deduped, dismissal-filtered list.
 * Returns an unsubscribe function.
 */
export function listenCommunityUpdates(
  uid: string | undefined,
  onNext: (updates: CommunityUpdate[]) => void
): () => void {
  let broadcasts: BroadcastDoc[] = [];
  let communities: IssueCommunity[] = [];
  let activities: VolunteerActivity[] = [];
  let dismissed = new Set<string>();

  let broadcastsReady = false;
  let communitiesReady = false;
  let activitiesReady = false;
  let dismissedReady = !uid;

  const emit = () => {
    if (!(broadcastsReady && communitiesReady && activitiesReady && dismissedReady)) return;
    onNext(buildUpdates(broadcasts, communities, activities, dismissed));
  };

  const unsubs: Array<() => void> = [];

  unsubs.push(
    onSnapshot(
      query(collection(db, "broadcasts"), orderBy("createdAt", "desc"), limit(10)),
      (snapshot) => {
        broadcasts = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<BroadcastDoc, "id">),
        }));
        broadcastsReady = true;
        emit();
      }
    )
  );

  if (uid) {
    unsubs.push(
      listenDismissedUpdateKeys(uid, (keys) => {
        dismissed = keys;
        dismissedReady = true;
        emit();
      })
    );
  }

  unsubs.push(
    listenOpenIssueCommunities((list) => {
      communities = list;
      communitiesReady = true;
      emit();
    })
  );

  unsubs.push(
    listenAllVolunteerActivities((list) => {
      activities = list;
      activitiesReady = true;
      emit();
    })
  );

  return () => unsubs.forEach((unsubscribe) => unsubscribe());
}