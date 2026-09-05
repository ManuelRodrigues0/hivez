import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Flame,
  HandHeart,
  LayoutDashboard,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useLiveUserSummary } from "@/hooks/useLiveProfile";
import { useUserLocation } from "@/context/LocationContext";
import {
  createVolunteerGroup,
  joinVolunteerGroup,
  listenAllVolunteerActivities,
  listenMyActivityParticipants,
  listenMyGroupMemberships,
  listenOpenIssueCommunities,
  listenVolunteerGroups,
} from "@/services/volunteering";
import { formatDistance, haversineKm, normalizeLocation } from "@/services/location";
import {
  activityScheduleState,
  formatScheduleText,
  isActivityThisWeek,
  isActivityToday,
  scheduleStateLabel,
} from "@/utils/volunteering";
import type {
  ActivityParticipant,
  IssueCommunity,
  VolunteerActivity,
  VolunteerGroup,
  VolunteerGroupMember,
} from "@/types/volunteering";

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

type Filter = "all" | "today" | "week" | "urgent" | "nearby";

export default function Volunteering() {
  const { user } = useAuth();
  // Live user summary (replaces one-time getUserSummary read).
  const summary = useLiveUserSummary(user?.uid);
  const userLocation = useUserLocation();
  const [activities, setActivities] = useState<VolunteerActivity[]>([]);
  const [participants, setParticipants] = useState<ActivityParticipant[]>([]);
  const [communities, setCommunities] = useState<IssueCommunity[]>([]);
  const [groups, setGroups] = useState<VolunteerGroup[]>([]);
  const [memberships, setMemberships] = useState<VolunteerGroupMember[]>([]);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupLocation, setGroupLocation] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("");

  useEffect(() => listenAllVolunteerActivities(setActivities), []);
  useEffect(() => listenOpenIssueCommunities(setCommunities), []);
  useEffect(() => listenVolunteerGroups(setGroups), []);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      listenMyActivityParticipants(user.uid, setParticipants),
      listenMyGroupMemberships(user.uid, setMemberships),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [user]);
const membershipIds = useMemo(() => new Set(memberships.map((item) => item.groupId)), [memberships]);
  const participantActivityIds = useMemo(
    () => new Set(participants.map((item) => item.activityId)),
    [participants]
  );

  const joinedActivities = useMemo(
    () => activities.filter((a) => participantActivityIds.has(a.id)),
    [activities, participantActivityIds]
  );

  const stats = useMemo(() => {
    const completed = joinedActivities.filter((a) =>
      ["COMPLETED", "VERIFIED"].includes(a.status)
    ).length;
    return {
      groups: memberships.length,
      activities: participants.length,
      completed,
      communities: new Set(participants.map((item) => item.communityId)).size,
    };
  }, [joinedActivities, memberships.length, participants]);

  const communitiesById = useMemo(() => new Map(communities.map((c) => [c.id, c])), [communities]);
  const groupsById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const userCoord = userLocation?.location
    ? { latitude: userLocation.location.latitude, longitude: userLocation.location.longitude }
    : null;

  /** Real distance in km when both a user location and a community snapshot exist. */
  function communityKm(communityId: string): number | null {
    if (!userCoord) return null;
    const community = communitiesById.get(communityId);
    const snap = normalizeLocation(community?.locationSnapshot);
    if (!community || !snap) return null;
    return haversineKm(userCoord, { latitude: snap.latitude, longitude: snap.longitude });
  }

  const activeOpportunities = useMemo(() => {
    return activities
      .filter((a) => !["CANCELLED", "COMPLETED", "VERIFIED"].includes(a.status))
      .sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`));
  }, [activities]);

  function matchesFilters(activity: VolunteerActivity): boolean {
    if (category && activity.category !== category) return false;
    if (filter === "today") return isActivityToday(activity);
    if (filter === "week") return isActivityThisWeek(activity);
    if (filter === "urgent") return activity.urgent;
    if (filter === "nearby") {
      const km = communityKm(activity.communityId);
      return km !== null && km <= 50;
    }
    return true;
  }

  // "Active" = happening now, flexible, or finished-but-not-closed. "Upcoming"
  // is derived purely from the real schedule so it always reflects start times.
  const activeShown = useMemo(
    () =>
      activeOpportunities
        .filter((a) => activityScheduleState(a) !== "UPCOMING" && matchesFilters(a))
        .slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeOpportunities, filter, category, userCoord, communitiesById]
  );

  const upcomingShown = useMemo(
    () =>
      activeOpportunities
        .filter((a) => activityScheduleState(a) === "UPCOMING" && matchesFilters(a))
        .slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeOpportunities, filter, category, userCoord, communitiesById]
  );

  const shownCommunities = useMemo(() => {
    let list = communities;
    if (category) list = list.filter((c) => c.category === category);
    if (filter === "nearby") {
      list = list.filter((c) => {
        const snap = normalizeLocation(c.locationSnapshot);
        if (!userCoord || !snap) return false;
        return haversineKm(userCoord, { latitude: snap.latitude, longitude: snap.longitude }) <= 50;
      });
    }
    return list.slice(0, 6);
  }, [communities, filter, category, userCoord]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((a) => a.category && set.add(a.category));
    communities.forEach((c) => c.category && set.add(c.category));
    return [...set].sort();
  }, [activities, communities]);

  const myGroups = useMemo(
    () => memberships.map((m) => groupsById.get(m.groupId)).filter((x): x is VolunteerGroup => Boolean(x)),
    [memberships, groupsById]
  );
async function handleCreateGroup(event: FormEvent) {
    event.preventDefault();
    if (!summary || !groupName.trim() || busy) return;
    setBusy(true);
    try {
      await createVolunteerGroup({
        name: groupName,
        location: groupLocation,
        description: groupDescription,
        owner: summary,
      });
      setGroupName("");
      setGroupLocation("");
      setGroupDescription("");
      setGroupFormOpen(false);
      toast.success("Volunteer group created");
    } catch (error) {
      console.error(error);
      toast.error("Could not create group");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinGroup(group: VolunteerGroup) {
    if (!summary || busy) return;
    setBusy(true);
    try {
      await joinVolunteerGroup(group, summary);
      toast.success(`Joined ${group.name}`);
    } catch (error) {
      console.error(error);
      toast.error("Could not join group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-page">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-black">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl">Volunteering</h1>
            <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">Discover real actions, join groups near you, and track your impact.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => setGroupFormOpen((open) => !open)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-200 px-4 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-800 dark:text-white dark:hover:bg-zinc-900"
            >
              <Plus size={16} />
              {groupFormOpen ? "Close" : "Create group"}
            </button>
            <Link
              to="/my-volunteering"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-bold text-white transition hover:scale-[1.02] dark:bg-white dark:text-black"
            >
              <LayoutDashboard size={16} />
              My volunteering
            </Link>
          </div>
        </div>

        {groupFormOpen && (
          <form onSubmit={handleCreateGroup} className="mt-4 grid gap-3 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
            <input value={groupLocation} onChange={(e) => setGroupLocation(e.target.value)} placeholder="Location / area" className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
            <textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="What does your group do?" className="min-h-20 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none sm:col-span-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
            <button disabled={busy || !groupName.trim()} className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-bold text-white disabled:opacity-50 sm:col-span-2 dark:bg-white dark:text-black">
              Create volunteer group
            </button>
          </form>
        )}
      </header>
<main className="space-y-8 px-4 py-5">
        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric icon={<HandHeart size={18} />} label="Groups" value={stats.groups} />
          <Metric icon={<CalendarDays size={18} />} label="Activities" value={stats.activities} />
          <Metric icon={<ArrowRight size={18} />} label="Completed" value={stats.completed} />
          <Metric icon={<Users size={18} />} label="Issues" value={stats.communities} />
        </section>

        {/* Filters */}
        <section className="flex flex-wrap items-center gap-2">
          {(["all", "today", "week", "urgent", "nearby"] as Filter[]).map((key) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`h-9 rounded-full px-4 text-sm font-bold transition ${
                filter === key
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {key === "all" ? "All" : key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-sm font-bold text-zinc-700 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c.replace(/-/g, " ")}</option>
            ))}
          </select>
        </section>
        {filter === "nearby" && (
          <p className="-mt-4 text-xs font-semibold text-zinc-500">
            {userCoord
              ? "Showing actions within 50 km of your set location, based on real location data only."
              : "Detect or set a location (Settings) to use the nearby filter."}
          </p>
        )}

        {/* Active opportunities */}
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-black tracking-tight text-zinc-950 dark:text-white">Active opportunities</h2>
            {activeShown.length > 0 && <span className="text-xs font-bold text-zinc-400">{activeShown.length} shown</span>}
          </div>
          {activeShown.length ? (
            <div className="grid gap-3">
              {activeShown.map((activity) => (
                <OpportunityCard key={activity.id} activity={activity} km={communityKm(activity.communityId)} />
              ))}
            </div>
          ) : (
            <EmptyBlock text="No volunteer actions are currently available." />
          )}
        </section>

        {/* Upcoming */}
        <section>
          <h2 className="mb-3 text-lg font-black tracking-tight text-zinc-950 dark:text-white">Upcoming opportunities</h2>
          {upcomingShown.length ? (
            <div className="grid gap-3">
              {upcomingShown.map((activity) => (
                <OpportunityCard key={activity.id} activity={activity} km={communityKm(activity.communityId)} />
              ))}
            </div>
          ) : (
            <EmptyBlock text="You're all caught up." />
          )}
        </section>

        {/* My volunteering strip */}
        <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-black tracking-tight text-zinc-950 dark:text-white">My volunteering</h2>
            <Link to="/my-volunteering" className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-950 dark:hover:text-white">
              Overview <ArrowRight size={14} />
            </Link>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">My groups</p>
            {myGroups.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {myGroups.map((group) => (
                  <Link
                    key={group.id}
                    to={`/volunteering/groups/${group.id}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <HandHeart size={13} />
                    {group.name}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">You haven't joined a volunteer group yet. Join one below.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Joined actions</p>
            {joinedActivities.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {joinedActivities.slice(0, 5).map((activity) => (
                  <Link
                    key={activity.id}
                    to={`/issue-community/${activity.communityId}`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  >
                    <CalendarDays size={13} />
                    {activity.title}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">Join a volunteer action to see it here.</p>
            )}
          </div>
        </section>
<section>
          <h2 className="mb-3 text-lg font-black tracking-tight text-zinc-950 dark:text-white">Issue communities</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {shownCommunities.map((community) => (
              <Link
                key={community.id}
                to={`/issue-community/${community.id}`}
                className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <IssuePreview community={community} />
                <div className="p-4">
                  <p className="text-base font-black text-zinc-950 dark:text-white">{community.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{community.description}</p>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-zinc-500">
                    <span>{community.memberCount} members</span>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {communityKm(community.id) !== null && <span>{formatDistance(communityKm(community.id))}</span>}
                      <span>{statusLabel(community.status)}</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {!shownCommunities.length && <EmptyBlock text="No issue communities match your filter." />}
        </section>

        {/* Volunteer groups */}
        <section>
          <h2 className="mb-3 text-lg font-black tracking-tight text-zinc-950 dark:text-white">Volunteer groups</h2>
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between gap-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <Link to={`/volunteer-group/${group.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-zinc-950 dark:text-white">{group.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{group.description || group.location}</p>
                  <p className="mt-2 text-xs font-semibold text-zinc-500">{group.memberCount} members</p>
                </Link>
                <button
                  disabled={busy || membershipIds.has(group.id)}
                  onClick={() => handleJoinGroup(group)}
                  className="h-10 shrink-0 rounded-full border border-zinc-200 px-4 text-sm font-bold text-zinc-900 transition hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-800 dark:text-white dark:hover:bg-zinc-900"
                >
                  {membershipIds.has(group.id) ? "Joined" : "Join"}
                </button>
              </div>
            ))}
            {!groups.length && (
              <EmptyBlock text="Create the first volunteer group for your area." />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-zinc-900">
      <div className="text-zinc-500">{icon}</div>
      <p className="mt-3 text-2xl font-black text-zinc-950 dark:text-white">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm font-semibold text-zinc-500 dark:border-zinc-800">
      {text}
    </div>
  );
}

function OpportunityCard({ activity, km }: { activity: VolunteerActivity; km: number | null }) {
  const state = activityScheduleState(activity);
  return (
    <Link
      to={`/issue-community/${activity.communityId}`}
      className="block rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex flex-wrap gap-2 text-[11px] font-bold">
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{statusLabel(activity.status)}</span>
        {activity.urgent && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 uppercase text-rose-600 dark:bg-rose-950 dark:text-rose-300">
            <Flame size={11} /> Urgent
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
          <Clock size={11} /> {scheduleStateLabel(state)}
        </span>
        {km !== null && <span className="rounded-full bg-sky-100 px-2.5 py-0.5 uppercase text-sky-600 dark:bg-sky-950 dark:text-sky-300">{formatDistance(km)}</span>}
      </div>
      <h3 className="mt-3 truncate text-base font-black text-zinc-950 dark:text-white">{activity.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{activity.description}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-zinc-500">
        <span className="inline-flex items-center gap-1"><Clock size={13} />{formatScheduleText(activity)}</span>
        {activity.location && <span className="inline-flex items-center gap-1"><MapPin size={13} />{activity.location}</span>}
        <span className="inline-flex items-center gap-1">
          <Users size={13} />{activity.volunteerCount}{activity.volunteerLimit ? `/${activity.volunteerLimit}` : ""}
        </span>
      </div>
    </Link>
  );
}

function IssuePreview({ community }: { community: IssueCommunity }) {
  if (!community.mediaUrl) return null;

  if (community.mediaType === "video") {
    return (
      <video
        src={community.mediaUrl}
        className="h-36 w-full object-cover"
        muted
        playsInline
        preload="metadata"
        disablePictureInPicture
      />
    );
  }

  return (
    <img
      src={community.mediaUrl}
      alt=""
      className="h-36 w-full object-cover"
      loading="lazy"
    />
  );
}