import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  HandHeart,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import HivezLoader from "@/components/common/HivezLoader";
import { useAuth } from "@/context/AuthContext";
import {
  listenAllVolunteerActivities,
  listenCommunityMemberships,
  listenMyActivityParticipants,
  listenMyEvidence,
  listenMyGroupMemberships,
  listenVolunteerGroups,
} from "@/services/volunteering";
import {
  activityScheduleState,
  formatScheduleText,
  scheduleFromActivity,
} from "@/utils/volunteering";
import type {
  ActivityEvidence,
  ActivityParticipant,
  CommunityMember,
  VolunteerActivity,
  VolunteerGroup,
  VolunteerGroupMember,
} from "@/types/volunteering";

function statusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

import type { CommunityRole } from "@/types/volunteering";

type MyGroup = VolunteerGroup & { myRole: CommunityRole };

export default function MyVolunteering() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<VolunteerActivity[]>([]);
  const [groups, setGroups] = useState<VolunteerGroup[]>([]);
  const [participants, setParticipants] = useState<ActivityParticipant[]>([]);
  const [memberships, setMemberships] = useState<VolunteerGroupMember[]>([]);
  const [communityMemberships, setCommunityMemberships] = useState<CommunityMember[]>([]);
  const [evidence, setEvidence] = useState<ActivityEvidence[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      listenMyActivityParticipants(user.uid, setParticipants),
      listenMyGroupMemberships(user.uid, setMemberships),
      listenCommunityMemberships(user.uid, setCommunityMemberships),
      listenMyEvidence(user.uid, setEvidence),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [user]);

  useEffect(() => listenAllVolunteerActivities(setActivities), []);
  useEffect(() => listenVolunteerGroups(setGroups), []);

  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const myGroups = useMemo(
    () =>
      memberships
        .map((m) => {
          const group = groupById.get(m.groupId);
          return group ? { ...group, myRole: m.role } : null;
        })
        .filter((x): x is MyGroup => Boolean(x)),
    [memberships, groupById]
  );

  /** The user's joined activities, preserving their participation metadata. */
  const joined = useMemo(() => {
    const byId = new Map(activities.map((a) => [a.id, a]));
    return participants
      .map((p) => byId.get(p.activityId))
      .filter((a): a is VolunteerActivity => Boolean(a));
  }, [participants, activities]);

  const open = joined.filter((a) => !["CANCELLED", "COMPLETED", "VERIFIED"].includes(a.status));
  const active = open.filter((a) => activityScheduleState(a) !== "UPCOMING");
  const upcoming = open.filter((a) => activityScheduleState(a) === "UPCOMING");
  const completed = joined.filter((a) => ["COMPLETED", "VERIFIED"].includes(a.status));

  const pendingEvidence = evidence.filter((e) => ["SUBMITTED", "REVIEWED"].includes(e.status));
  const acceptedEvidence = evidence.filter((e) => e.status === "ACCEPTED");

  const issuesSupported = useMemo(() => {
    const set = new Set<string>();
    communityMemberships.forEach((m) => set.add(m.communityId));
    participants.forEach((p) => p.communityId && set.add(p.communityId));
    return set.size;
  }, [communityMemberships, participants]);

  // Real volunteer hours only when both ends of the schedule exist.
  const volunteerHours = useMemo(() => {
    return completed.reduce((sum, a) => {
      const { startMs, endMs } = scheduleFromActivity(a);
      if (startMs === null || endMs === null) return sum;
      return sum + Math.max(0, (endMs - startMs) / 3_600_000);
    }, 0);
  }, [completed]);

  if (!user) {
    return (
      <div className="app-page">
        <div className="app-empty-state">
          <HivezLoader size="md" progress={42} label="Loading your volunteering" />
        </div>
      </div>
    );
  }
return (
    <div className="app-page">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-black">
        <Link to="/volunteering" className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-zinc-950 dark:hover:text-white">
          <ArrowLeft size={14} /> Volunteering
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-black">
            <HandHeart size={20} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl">My volunteering</h1>
            <p className="text-xs text-zinc-500 sm:text-sm">Your groups, actions, evidence and impact - all live.</p>
          </div>
        </div>
      </header>

      <main className="space-y-8 px-4 py-5">
        {/* Impact */}
        <section>
          <h2 className="mb-3 text-lg font-black tracking-tight text-zinc-950 dark:text-white">My impact</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric icon={<HandHeart size={17} />} label="Activities joined" value={participants.length} />
            <Metric icon={<CheckCircle2 size={17} />} label="Completed" value={completed.length} />
            <Metric icon={<Users size={17} />} label="Issues supported" value={issuesSupported} />
            <Metric icon={<ShieldCheck size={17} />} label="Groups joined" value={memberships.length} />
            <Metric icon={<CheckCircle2 size={17} />} label="Verified" value={acceptedEvidence.length} />
            <Metric icon={<Clock size={17} />} label="Hours" value={volunteerHours ? Math.round(volunteerHours * 10) / 10 : 0} />
          </div>
          {!volunteerHours && (
            <p className="mt-2 text-xs font-semibold text-zinc-400">Volunteer hours are calculated only from actions with a complete start and end schedule.</p>
          )}
        </section>

        {/* Groups */}
        <section>
          <h2 className="mb-3 text-lg font-black tracking-tight text-zinc-950 dark:text-white">My groups</h2>
          {myGroups.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {myGroups.map((group) => (
                <Link key={group.id} to={`/volunteer-group/${group.id}`} className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-base font-black text-zinc-950 dark:text-white">{group.name}</p>
                    <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold capitalize text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{group.myRole}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{group.description || group.location}</p>
                  <p className="mt-3 text-xs font-semibold text-zinc-500">{group.memberCount} members</p>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyBlock text="You haven't joined a volunteer group yet." />
          )}
        </section>

        {/* Active */}
        <section>
          <h2 className="mb-3 text-lg font-black tracking-tight text-zinc-950 dark:text-white">Active activities</h2>
          {active.length ? (
            <div className="space-y-3">
              {active.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}
            </div>
          ) : (
            <EmptyBlock text="No active volunteer actions right now." />
          )}
        </section>

        {/* Upcoming */}
        <section>
          <h2 className="mb-3 text-lg font-black tracking-tight text-zinc-950 dark:text-white">Upcoming</h2>
          {upcoming.length ? (
            <div className="space-y-3">
              {upcoming.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}
            </div>
          ) : (
            <EmptyBlock text="You're all caught up." />
          )}
        </section>

        {/* Completed */}
        <section>
          <h2 className="mb-3 text-lg font-black tracking-tight text-zinc-950 dark:text-white">Completed</h2>
          {completed.length ? (
            <div className="space-y-3">
              {completed.map((activity) => <ActivityRow key={activity.id} activity={activity} />)}
            </div>
          ) : (
            <EmptyBlock text="Complete an action to build your history." />
          )}
        </section>

        {/* Evidence */}
        <section>
          <h2 className="mb-3 text-lg font-black tracking-tight text-zinc-950 dark:text-white">Pending verification</h2>
          {pendingEvidence.length ? (
            <div className="space-y-3">
              {pendingEvidence.map((item) => (
                <EvidenceRow key={item.id} item={item} activities={activities} />
              ))}
            </div>
          ) : (
            <EmptyBlock text="No evidence awaiting review." />
          )}
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
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
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

function ActivityRow({ activity }: { activity: VolunteerActivity }) {
  return (
    <Link
      to={`/issue-community/${activity.communityId}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="min-w-0">
        <p className="truncate text-base font-black text-zinc-950 dark:text-white">{activity.title}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-zinc-500">
          <span className="inline-flex items-center gap-1"><Clock size={12} />{formatScheduleText(activity)}</span>
          {activity.location && <span className="inline-flex items-center gap-1"><MapPin size={12} />{activity.location}</span>}
          {activity.groupId && <span className="rounded-full bg-violet-100 px-2 py-0.5 font-bold text-violet-600 dark:bg-violet-950 dark:text-violet-300">Group action</span>}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
        {statusLabel(activity.status)}
      </span>
    </Link>
  );
}

function EvidenceRow({ item, activities }: { item: ActivityEvidence; activities: VolunteerActivity[] }) {
  const activityName = activities.find((a) => a.id === item.activityId)?.title || "Volunteer action";
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{activityName}</p>
          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{item.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold uppercase text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          {statusLabel(item.status)}
        </span>
      </div>
      {item.mediaUrl && (
        <img src={item.mediaUrl} alt="" className="mt-3 max-h-48 w-full rounded-2xl object-cover" loading="lazy" />
      )}
    </div>
  );
}