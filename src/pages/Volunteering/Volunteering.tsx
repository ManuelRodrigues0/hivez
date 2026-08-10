import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, HandHeart, MapPin, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  createVolunteerGroup,
  getUserSummary,
  joinVolunteerGroup,
  listenAllVolunteerActivities,
  listenMyActivityParticipants,
  listenMyGroupMemberships,
  listenOpenIssueCommunities,
  listenVolunteerGroups,
} from "@/services/volunteering";
import type {
  ActivityParticipant,
  IssueCommunity,
  VolunteerActivity,
  VolunteerGroup,
  VolunteerGroupMember,
  VolunteerUserSummary,
} from "@/types/volunteering";

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

export default function Volunteering() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<VolunteerUserSummary | null>(null);
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

  useEffect(() => {
    if (!user) return;
    getUserSummary(user.uid).then(setSummary);
  }, [user]);

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
  const participantActivityIds = useMemo(() => new Set(participants.map((item) => item.activityId)), [participants]);

  const stats = useMemo(() => {
    const joinedActivities = activities.filter((activity) => participantActivityIds.has(activity.id));
    const completed = joinedActivities.filter((activity) =>
      ["COMPLETED", "VERIFIED"].includes(activity.status)
    ).length;
    return {
      groups: memberships.length,
      activities: participants.length,
      completed,
      communities: new Set(participants.map((item) => item.communityId)).size,
    };
  }, [activities, memberships.length, participantActivityIds, participants]);

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
      <header className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white/90 px-4 py-4 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-black/90 sm:rounded-t-3xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">Hivez action</p>
            <h1 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">Volunteering</h1>
          </div>
          <button
            type="button"
            onClick={() => setGroupFormOpen((value) => !value)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-bold text-white transition hover:scale-[1.02] active:scale-95 dark:bg-white dark:text-black"
          >
            <Plus size={17} />
            Group
          </button>
        </div>
      </header>

      <main className="space-y-5 px-4 py-5">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Groups", stats.groups],
            ["Activities", stats.activities],
            ["Completed", stats.completed],
            ["Issues", stats.communities],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-2xl font-black text-zinc-950 dark:text-white">{value}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
            </div>
          ))}
        </section>

        {groupFormOpen && (
          <form onSubmit={handleCreateGroup} className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-white" />
            <input value={groupLocation} onChange={(e) => setGroupLocation(e.target.value)} placeholder="Area or city" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-white" />
            <textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} placeholder="What will this group help with?" className="min-h-24 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-white" />
            <button disabled={busy || !groupName.trim()} className="h-11 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">Create group</button>
          </form>
        )}

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-black tracking-tight text-zinc-950 dark:text-white">Open actions</h2>
              <p className="text-sm text-zinc-500">Volunteer opportunities created from real local reports.</p>
            </div>
          </div>
          <div className="space-y-3">
            {activities.slice(0, 8).map((activity) => (
              <Link key={activity.id} to={`/issue-community/${activity.communityId}`} className="block rounded-3xl border border-zinc-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-black text-zinc-950 dark:text-white">{activity.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{activity.description}</p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{statusLabel(activity.status)}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><CalendarDays size={14} />{activity.startDate || "Flexible"}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><MapPin size={14} />{activity.location || "Nearby"}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><Users size={14} />{activity.volunteerCount}{activity.volunteerLimit ? `/${activity.volunteerLimit}` : ""}</span>
                  {participantActivityIds.has(activity.id) && <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Joined</span>}
                </div>
              </Link>
            ))}
            {!activities.length && (
              <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">No volunteer actions yet. Open an issue community from a post and create the first action.</div>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-black tracking-tight text-zinc-950 dark:text-white">Issue communities</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {communities.slice(0, 6).map((community) => (
              <Link key={community.id} to={`/issue-community/${community.id}`} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
                {community.mediaUrl && <img src={community.mediaUrl} alt="" className="h-36 w-full object-cover" loading="lazy" />}
                <div className="p-4">
                  <p className="text-base font-black text-zinc-950 dark:text-white">{community.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{community.description}</p>
                  <div className="mt-4 flex items-center justify-between text-xs font-bold text-zinc-500">
                    <span>{community.memberCount} members</span>
                    <span>{statusLabel(community.status)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-black tracking-tight text-zinc-950 dark:text-white">Volunteer groups</h2>
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between gap-4 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="min-w-0">
                  <p className="truncate text-base font-black text-zinc-950 dark:text-white">{group.name}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{group.description || group.location}</p>
                  <p className="mt-2 text-xs font-semibold text-zinc-500">{group.memberCount} members</p>
                </div>
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
              <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">
                <HandHeart className="mx-auto mb-3" size={32} />
                Create the first volunteer group for your area.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
