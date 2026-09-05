/**
 * Schedule helpers for volunteer activities.
 *
 * All date/time fields are plain strings (startDate "YYYY-MM-DD", startTime
 * "HH:MM") so parsing is done here in one place. Statuses are derived from
 * real timestamps only - the UI never claims an activity is "happening now"
 * unless the schedule can actually confirm it.
 */
import type { VolunteerActivity } from "@/types/volunteering";

export type ScheduleState = "FLEXIBLE" | "UPCOMING" | "ACTIVE" | "OVER";

export interface ActivitySchedule {
  startMs: number | null;
  endMs: number | null;
  hasEnd: boolean;
}

function parsePart(day: string | undefined | null, time: string | undefined | null): number | null {
  if (!day) return null;
  const date = new Date(`${day}T${time || "00:00"}:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function scheduleFromActivity(activity: Pick<VolunteerActivity, "startDate" | "startTime" | "endDate" | "endTime">): ActivitySchedule {
  const startMs = activity.startDate ? parsePart(activity.startDate, activity.startTime) : null;
  const endSource = activity.endDate || activity.startDate;
  const endMs = endSource ? parsePart(endSource, activity.endTime) : null;
  return { startMs, endMs, hasEnd: Boolean(endMs) };
}

/**
 * Schedule state for an activity:
 * - "FLEXIBLE"   -> no start date was ever set
 * - "UPCOMING"   -> starts in the future
 * - "ACTIVE"     -> started and (no end time, or not yet ended)
 * - "OVER"       -> ended
 */
export function activityScheduleState(activity: Pick<VolunteerActivity, "startDate" | "startTime" | "endDate" | "endTime">, now: number = Date.now()): ScheduleState {
  const { startMs, endMs, hasEnd } = scheduleFromActivity(activity);
  if (startMs === null) return "FLEXIBLE";
  if (now < startMs) return "UPCOMING";
  if (hasEnd && now >= (endMs as number)) return "OVER";
  return "ACTIVE";
}

export function activityEnded(activity: Pick<VolunteerActivity, "startDate" | "startTime" | "endDate" | "endTime">, now: number = Date.now()): boolean {
  return activityScheduleState(activity, now) === "OVER";
}

export function isActivityToday(activity: Pick<VolunteerActivity, "startDate">, now: Date = new Date()): boolean {
  return Boolean(activity.startDate) && activity.startDate === toDateKey(now);
}

export function isActivityThisWeek(activity: Pick<VolunteerActivity, "startDate">, now: Date = new Date()): boolean {
  if (!activity.startDate) return false;
  const start = parseDateKey(activity.startDate);
  if (!start) return false;
  const endOfWeek = new Date(now);
  endOfWeek.setHours(23, 59, 59, 999);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay()));
  return start >= now && start <= endOfWeek;
}

export function parseDateKey(key: string): Date | null {
  const date = new Date(`${key}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toTimeKey(date: Date): string {
  return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`;
}

function timeLabel(time: string): string {
  if (!time) return "";
  const [hour = "", minute = "00"] = time.split(":");
  const h = Number(hour);
  if (!Number.isFinite(h)) return time;
  const suffix = h >= 12 ? "pm" : "am";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${minute || "00"} ${suffix}`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Single human-readable schedule line: "Fri, Sep 5 at 9:00 am",
 * "Fri, Sep 5 at 9:00 am – 11:00 am", or "Fri, Sep 5 – Sat, Sep 6".
 */
export function formatScheduleText(activity: Pick<VolunteerActivity, "startDate" | "startTime" | "endDate" | "endTime">): string {
  const { startMs, endMs, hasEnd } = scheduleFromActivity(activity);
  if (startMs === null) return "Flexible schedule";
  const start = new Date(startMs);
  const startText = `${DAYS[start.getDay()]} ${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const startTimeLabel = timeLabel(activity.startTime || "9:00");
  if (!hasEnd) return `${startText} at ${startTimeLabel}`;
  const end = new Date(endMs as number);
  if (toDateKey(start) === toDateKey(end)) {
    return `${startText} at ${startTimeLabel} – ${timeLabel(activity.endTime || "12:00")}`;
  }
  return `${startText} – ${DAYS[end.getDay()]} ${MONTHS[end.getMonth()]} ${end.getDate()} at ${timeLabel(activity.endTime || "12:00")}`;
}

/** Human label for the schedule state (used for badges). */
export function scheduleStateLabel(state: ScheduleState): string {
  switch (state) {
    case "FLEXIBLE": return "Flexible";
    case "UPCOMING": return "Upcoming";
    case "ACTIVE": return "Happening now";
    case "OVER": return "Finished";
  }
}