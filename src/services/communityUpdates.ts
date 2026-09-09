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
 *   { id, type, title, description, timestamp, eventDate, priority, targetUrl }
 * `id` is a stable dedupe key also used for per-user dismissal.
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
import { listenAllVolunteerActivities, listenOpenIssueCommunities } from "@/services/volunteering";
export type CommunityUpdateType =
  | "volunteering" // open volunteer session (no fixed schedule yet)
  | "event" // scheduled community event (volunteer activity with a date)
  | "issue_resolved" // a community issue was marked resolved
  | "announcement" // important community announcement (admin broadcast)
  | "system"; // reserved for real system notices (no source yet)

export type UpdatePriority = "high" | "medium" | "low";

export interface CommunityUpdate {
  /** Stable dedupe + dismissal key: "activity:<id>", "issue:<id>", "broadcast:<id>". */
  id: string;
  type: CommunityUpdateType;
  title: string;
  /** One-line summary (or pre-formatted event time for scheduled events). */
  description: string;
  /** When the update happened (Firestore-style timestamp). */
  timestamp: { toDate?: () => Date } | Date | null;
  /** Present for scheduled events/volunteering; used for ranking + display. */
  eventDate: { startMs: number; label: string } | null;
  priority: UpdatePriority;
  targetUrl: string | null;
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
  };
}

function fromResolvedIssue(community: IssueCommunity): CommunityUpdate {
  const location = community.location?.trim();
  return {
    id: `issue:${community.id}`,
    type: "issue_resolved",
    title: community.title || "Community issue",
    description: location ? `Resolved · ${location}` : "Resolved issue",
    timestamp: community.updatedAt || community.createdAt || null,
    eventDate: null,
    priority: issuePriority(community),
    targetUrl: `/issue-community/${community.id}`,
  };
}

function fromActivity(activity: VolunteerActivity): CommunityUpdate {
  const startMs = activity.startDate ? parseSchedule(activity.startDate, activity.startTime) : 0;
  const locationText = activity.location?.trim();
  const description =
    startMs > 0
      ? formatEventDate(activity.startDate, activity.startTime)
      : locationText
        ? `Volunteer session · ${locationText}`
        : "Volunteer session";
  return {
    id: `activity:${activity.id}`,
    type: startMs > 0 ? "event" : "volunteering",
    title: activity.title || "Volunteer session",
    description,
    timestamp: activity.createdAt || activity.updatedAt || null,
    eventDate: startMs > 0 ? { startMs, label: description } : null,
    priority: activityPriority(activity, Date.now()),
    targetUrl: `/issue-community/${activity.communityId}`,
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