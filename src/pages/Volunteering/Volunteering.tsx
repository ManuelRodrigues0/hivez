// HIVEZ — VOLUNTEERING · canonical page layer (ONE FILE, MANY COMPONENTS)
// Routes preserved:
//   /volunteering                         → Volunteering (hub)
//   /my-volunteering                      → MyVolunteering
//   /issue-community/:communityId         → IssueCommunity
//   /issue-community/:communityId/details → CommunityDetails
//   /volunteer-group/:groupId             → VolunteerGroupPage
//   VerificationPanel                     → mounted by IssueCommunity (not routed)
// Collisions resolved by RENAMING LOCAL IDENTIFIERS ONLY (no logic merged):
//   statusLabel → volunteering|myVolunteeringStatusLabel
//   Metric/EmptyBlock → <Feature>Metric / <Feature>EmptyBlock
//   tabs/Tab → issueCommunity|volunteerGroup<Tabs|Tab>
//   pretty → <feature>StatusText · timeText → <feature>TimeText
//   MessagePanel → <Feature>MessagePanel · roleColors → community|groupRoleColors
// Consolidated verbatim from 6 former page files. Realtime listeners, state,
// permissions, actions and styling unchanged — structural merge only.

// ============================================================
// IMPORTS
// ============================================================

import { doc, onSnapshot } from "firebase/firestore";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Crown,
  Eye,
  Flame,
  HandHeart,
  LayoutDashboard,
  Loader2,
  MapPin,
  Megaphone,
  MessageSquare,
  Plus,
  RotateCcw,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import HivezLoader from "@/components/common/HivezLoader.tsx";
import EvidenceGallery from "@/components/volunteering/EvidenceGallery.tsx";
import MediaViewer, { detectMediaType } from "@/components/volunteering/MediaViewer.tsx";
import { useAuth } from "@/context/AuthContext.tsx";
import { useUserLocation } from "@/context/LocationContext.tsx";
import { db } from "@/firebase/firebase.ts";
import { useLiveProfile, useLiveUserSummary } from "@/hooks/useLiveProfile.ts";
import { formatDistance, haversineKm, normalizeLocation } from "@/services/location.ts";
import { uploadToCloudinary } from "@/services/mediaUpload.ts";
import {
  activateFallbackVerification,
  addActivityTask,
  assignParticipantRole,
  closePoll,
  createPoll,
  createVolunteerActivity,
  createVolunteerGroup,
  deletePoll,
  joinActivity,
  joinIssueCommunity,
  joinVolunteerGroup,
  leaveActivity,
  leaveIssueCommunity,
  leaveVolunteerGroup,
  linkGroupIssue,
  listenActivityEvidence,
  listenActivityParticipant,
  listenActivityParticipants,
  listenAllVolunteerActivities,
  listenCommunityConfirmations,
  listenCommunityMember,
  listenCommunityMembers,
  listenCommunityMemberships,
  listenCommunityMessages,
  listenCommunityPolls,
  listenGroup,
  listenGroupActivities,
  listenGroupMember,
  listenGroupMembers,
  listenGroupMessages,
  listenIssueCommunity,
  listenMyActivityParticipants,
  listenMyEvidence,
  listenMyGroupMemberships,
  listenMyReviewCases,
  listenOpenIssueCommunities,
  listenVerificationCases,
  listenVerificationDecisions,
  listenVerificationEvents,
  listenVolunteerActivities,
  listenVolunteerGroups,
  listenWitnessConfirmations,
  logContactUpdate,
  removeActivityTask,
  removeCommunityMember,
  removeGroupMember,
  reopenPoll,
  reopenVerificationCase,
  reviewActivityEvidence,
  sendCommunityMessage,
  sendGroupMessage,
  setParticipantStatus,
  submitActivityEvidence,
  submitCommunityConfirmation,
  submitReviewerDecision,
  submitWitnessConfirmation,
  toggleActivityTask,
  transferGroupOwnership,
  unlinkGroupIssue,
  updateActionProgress,
  updateActivityDetails,
  updateActivityStatus,
  updateCommunityMemberRole,
  updateCommunityStatus,
  updateGroupDetails,
  updateGroupMemberRole,
  votePoll,
} from "@/services/volunteering.ts";
import {
  type ActionProgressState,
  type ActionTypeKey,
  type ActivityEvidence,
  type ActivityParticipant,
  type CommunityConfirmation,
  type CommunityMember,
  type CommunityMessage,
  type CommunityPoll,
  type CommunityRole,
  type EvidenceTypeKey,
  type IssueCommunity,
  type IssueCommunityStatus,
  MORE_EVIDENCE_REASONS,
  type ParticipantStatus,
  type PollVote,
  REJECT_REASONS,
  type ReviewerDecision,
  type VerificationCase,
  type VerificationCaseEvent,
  type VerificationDecision,
  type VolunteerActivity,
  type VolunteerActivityStatus,
  type VolunteerGroup,
  type VolunteerGroupMember,
  type VolunteerGroupMessage,
  type VolunteerUserSummary,
  type WitnessConfirmation,
  type VerificationConfidenceLevel,
} from "@/types/volunteering.ts";
import {
  ACTION_TYPE_GROUPS,
  ACTION_TYPES,
  actionTypeSummary,
  createActionLabel,
  getActionFormConfig,
  getActionType,
  progressStateLabel,
  suggestedActionTypes,
} from "@/utils/actionTypes.ts";
import {
  computeVerificationConfidence,
  isCaseReviewable,
  reviewerDecisionLabel,
  verificationCaseStatusLabel,
  verificationTimeText,
} from "@/utils/verification.ts";
import {
  activityScheduleState,
  formatScheduleText,
  isActivityThisWeek,
  isActivityToday,
  scheduleFromActivity,
  scheduleStateLabel,
} from "@/utils/volunteering.ts";

// ============================================================
// VOLUNTEERING HOME   (consolidated from Volunteering.tsx)
// ============================================================

function volunteeringStatusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}

type Filter = "all" | "today" | "week" | "urgent" | "nearby";

function Volunteering() {
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
          <VolunteeringMetric icon={<HandHeart size={18} />} label="Groups" value={stats.groups} />
          <VolunteeringMetric icon={<CalendarDays size={18} />} label="Activities" value={stats.activities} />
          <VolunteeringMetric icon={<ArrowRight size={18} />} label="Completed" value={stats.completed} />
          <VolunteeringMetric icon={<Users size={18} />} label="Issues" value={stats.communities} />
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
            <VolunteeringEmptyBlock text="No volunteer actions are currently available." />
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
            <VolunteeringEmptyBlock text="You're all caught up." />
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
                      <span>{volunteeringStatusLabel(community.status)}</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {!shownCommunities.length && <VolunteeringEmptyBlock text="No issue communities match your filter." />}
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
              <VolunteeringEmptyBlock text="Create the first volunteer group for your area." />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
function VolunteeringMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-zinc-900">
      <div className="text-zinc-500">{icon}</div>
      <p className="mt-3 text-2xl font-black text-zinc-950 dark:text-white">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}

function VolunteeringEmptyBlock({ text }: { text: string }) {
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
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{volunteeringStatusLabel(activity.status)}</span>
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
// ============================================================
// MY VOLUNTEERING   (consolidated from MyVolunteering.tsx)
// ============================================================

function myVolunteeringStatusLabel(status: string) {
  return status.replaceAll("_", " ").toLowerCase();
}


type MyGroup = VolunteerGroup & { myRole: CommunityRole };

function MyVolunteering() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<VolunteerActivity[]>([]);
  const [groups, setGroups] = useState<VolunteerGroup[]>([]);
  const [participants, setParticipants] = useState<ActivityParticipant[]>([]);
  const [memberships, setMemberships] = useState<VolunteerGroupMember[]>([]);
  const [communityMemberships, setCommunityMemberships] = useState<CommunityMember[]>([]);
  const [evidence, setEvidence] = useState<ActivityEvidence[]>([]);
  const [reviewCases, setReviewCases] = useState<VerificationCase[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      listenMyActivityParticipants(user.uid, setParticipants),
      listenMyGroupMemberships(user.uid, setMemberships),
      listenCommunityMemberships(user.uid, setCommunityMemberships),
      listenMyEvidence(user.uid, setEvidence),
      listenMyReviewCases(user.uid, setReviewCases),
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
            <MyVolunteeringMetric icon={<HandHeart size={17} />} label="Activities joined" value={participants.length} />
            <MyVolunteeringMetric icon={<CheckCircle2 size={17} />} label="Completed" value={completed.length} />
            <MyVolunteeringMetric icon={<Users size={17} />} label="Issues supported" value={issuesSupported} />
            <MyVolunteeringMetric icon={<ShieldCheck size={17} />} label="Groups joined" value={memberships.length} />
            <MyVolunteeringMetric icon={<CheckCircle2 size={17} />} label="Verified" value={acceptedEvidence.length} />
            <MyVolunteeringMetric icon={<Clock size={17} />} label="Hours" value={volunteerHours ? Math.round(volunteerHours * 10) / 10 : 0} />
          </div>
          {!volunteerHours && (
            <p className="mt-2 text-xs font-semibold text-zinc-400">Volunteer hours are calculated only from actions with a complete start and end schedule.</p>
          )}
        </section>

        {/* Review queue */}
        {reviewCases.length > 0 && (
          <section>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-lg font-black tracking-tight text-zinc-950 dark:text-white">Awaiting your review</h2>
              <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">{reviewCases.length} open</span>
            </div>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Cases where you are the post owner or an authorized reviewer. Verdicts are permanent and audited.
            </p>
            <div className="space-y-3">
              {reviewCases.map((caseData) => (
                <ReviewCaseRow
                  key={caseData.id}
                  caseData={caseData}
                  isPrimary={caseData.primaryReviewerId === user.uid}
                  title={activities.find((a) => a.id === caseData.activityId)?.title}
                />
              ))}
            </div>
          </section>
        )}

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
            <MyVolunteeringEmptyBlock text="You haven't joined a volunteer group yet." />
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
            <MyVolunteeringEmptyBlock text="No active volunteer actions right now." />
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
            <MyVolunteeringEmptyBlock text="You're all caught up." />
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
            <MyVolunteeringEmptyBlock text="Complete an action to build your history." />
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
            <MyVolunteeringEmptyBlock text="No evidence awaiting review." />
          )}
        </section>
      </main>
    </div>
  );
}
function MyVolunteeringMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-zinc-900">
      <div className="text-zinc-500">{icon}</div>
      <p className="mt-3 text-2xl font-black text-zinc-950 dark:text-white">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}

function MyVolunteeringEmptyBlock({ text }: { text: string }) {
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
        {myVolunteeringStatusLabel(activity.status)}
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
          {myVolunteeringStatusLabel(item.status)}
        </span>
      </div>
      {item.mediaUrl && (
        <img src={item.mediaUrl} alt="" className="mt-3 max-h-48 w-full rounded-2xl object-cover" loading="lazy" />
      )}
    </div>
  );
}

const caseStatusStyles: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
  DISPUTED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  NEEDS_MORE_EVIDENCE: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
};

function ReviewCaseRow({
  caseData,
  isPrimary,
  title,
}: {
  caseData: VerificationCase;
  isPrimary: boolean;
  title?: string;
}) {
  const deadlineText = caseData.ownerResponseDeadline
    ? new Date(caseData.ownerResponseDeadline).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;
  return (
    <Link
      to={`/issue-community/${caseData.communityId}?tab=Verification`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <ClipboardCheck size={15} className="shrink-0 text-zinc-500" />
          <p className="truncate text-sm font-black text-zinc-950 dark:text-white">
            {title || "Community verification case"}
          </p>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 size={12} />
            {caseData.approvalCount}/{caseData.requiredApprovals} approvals
          </span>
          <span className="inline-flex items-center gap-1">
            <XCircle size={12} />
            {caseData.rejectionCount}/{caseData.requiredRejections} rejections
          </span>
          {caseData.moreEvidenceCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={12} />
              {caseData.moreEvidenceCount} more-evidence request{caseData.moreEvidenceCount === 1 ? "" : "s"}
            </span>
          )}
          {isPrimary ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 font-bold text-violet-600 dark:bg-violet-950 dark:text-violet-300">
              You're the post owner
            </span>
          ) : (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 font-bold text-sky-600 dark:bg-sky-950 dark:text-sky-300">
              Authorized reviewer
            </span>
          )}
        </div>
        {caseData.fallbackActivated && (
          <p className="mt-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            Owner didn't respond in time - community fallback review is active.
          </p>
        )}
        {!caseData.fallbackActivated && deadlineText && (
          <p className="mt-2 text-[11px] font-semibold text-zinc-500">
            Owner response window ends {deadlineText}.
          </p>
        )}
        {caseData.disputeNote && (
          <p className="mt-2 line-clamp-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            {caseData.disputeNote}
          </p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase ${
          caseStatusStyles[caseData.status] || "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"
        }`}
      >
        {verificationCaseStatusLabel(caseData.status)}
      </span>
    </Link>
  );
}
// ============================================================
// COMMUNITY DETAILS   (consolidated from CommunityDetails.tsx)
// ============================================================

const roleIcons: Record<string, typeof Crown> = {
  owner: Crown,
  organizer: Shield,
  moderator: UserCheck,
  member: Users,
};

const communityRoleColors: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  organizer: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  moderator: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  member: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
};

function CommunityDetails() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [community, setCommunity] = useState<IssueCommunity | null>(null);
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [busy, setBusy] = useState(false);
  // Live user summary so joins/leaves write current profile data.
  const summary = useLiveUserSummary(user?.uid);

  useEffect(() => {
    if (!communityId) return;
    return listenIssueCommunity(communityId, setCommunity);
  }, [communityId]);

  useEffect(() => {
    if (!communityId || !user) return;
    return listenCommunityMember(communityId, user.uid, setMember);
  }, [communityId, user]);

  useEffect(() => {
    if (!communityId) return;
    return listenCommunityMembers(communityId, setMembers);
  }, [communityId]);

  const isMember = Boolean(member);

  async function handleJoinCommunity() {
    if (!community || !summary || busy) return;
    setBusy(true);
    try {
      await joinIssueCommunity(community, summary);
      toast.success("Joined issue community");
    } catch (error) {
      console.error(error);
      toast.error("Could not join community");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeaveCommunity() {
    if (!community || !member || busy) return;
    setBusy(true);
    try {
      await leaveIssueCommunity(community, member);
      toast.success("Left community");
    } catch (error: any) {
      toast.error(error?.message || "Could not leave community");
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m: CommunityMember) => {
      counts[m.role] = (counts[m.role] || 0) + 1;
    });
    return counts;
  }, [members]);

  if (!community) {
    return (
      <div className="app-page">
        <div className="app-empty-state">
          <HivezLoader size="md" progress={58} label="Loading community details" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      {/* Header */}
      <div className="app-sticky-header">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="app-icon-button">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-zinc-900 dark:text-white">
              {community.title}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Community details</p>
          </div>
        </div>
      </div>

      {/* Community Info */}
      <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800">
        {community.mediaUrl && (
          <div className="mb-4 aspect-video w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
            {community.mediaType === "video" ? (
              <video src={community.mediaUrl} className="h-full w-full object-cover" controls playsInline disablePictureInPicture />
            ) : (
              <img src={community.mediaUrl} alt="" className="h-full w-full object-cover" />
            )}
          </div>
        )}

        <h2 className="text-2xl font-black text-zinc-950 dark:text-white">{community.title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{community.description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            <Users size={14} />
            {community.memberCount} members
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {community.status.replace(/_/g, " ")}
          </span>
        </div>

        {/* Role Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(stats).map(([role, count]) => {
            const Icon = roleIcons[role] || Users;
            return (
              <div key={role} className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center gap-2">
                  <div className={`rounded-full p-1.5 ${communityRoleColors[role] || communityRoleColors.member}`}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <p className="text-lg font-black text-zinc-950 dark:text-white">{count}</p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 capitalize">{role}s</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="mt-5 flex flex-wrap gap-2">
          {!isMember ? (
            <button onClick={handleJoinCommunity} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white transition hover:scale-[1.02] disabled:opacity-60 dark:bg-white dark:text-black">
              <HandHeart size={17} /> Join community
            </button>
          ) : (
            <button onClick={handleLeaveCommunity} disabled={busy || member?.role === "owner"} className="h-11 rounded-full border border-zinc-200 px-5 text-sm font-bold text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:text-white">
              {member?.role === "owner" ? "Owner" : "Leave"}
            </button>
          )}
          {community.postId && (
            <Link to={`/post/${community.postId}`} className="inline-flex h-11 items-center rounded-full border border-zinc-200 px-5 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-white">
              View original post
            </Link>
          )}
        </div>

        {/* Rules */}
        {community.rules && community.rules.length > 0 && (
          <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-sm font-black text-zinc-950 dark:text-white">Community Rules</h3>
            <ul className="mt-3 space-y-2">
              {community.rules.map((rule: string, index: number) => (
                <li key={index} className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold dark:bg-zinc-900">
                    {index + 1}
                  </span>
                  {rule}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Members List */}
      <div className="px-4 py-5">
        <h3 className="mb-4 text-lg font-black text-zinc-950 dark:text-white">All Members</h3>
        <div className="space-y-2">
          {members.map((member: CommunityMember) => (
            <MemberRow key={member.id} member={member} />
          ))}
        </div>
      </div>
    </div>
  );
}

function MemberRow({ member }: { member: CommunityMember }) {
  const Icon = roleIcons[member.role] || Users;
  // Live profile: member rows always show current name/avatar even though the
  // membership doc stores a join-time snapshot.
  const liveUser = useLiveProfile(member.uid, member.user) || member.user;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700">
      <img
        src={liveUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.user.displayName)}&background=111&color=fff`}
        alt=""
        className="h-10 w-10 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-zinc-950 dark:text-white">
          {liveUser.displayName || member.user.displayName}
        </p>
        <p className="truncate text-xs text-zinc-500">
          @{liveUser.username || member.user.username || "hivez"}
        </p>
      </div>
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${communityRoleColors[member.role] || communityRoleColors.member}`}>
        <Icon size={12} />
        {member.role}
      </span>
    </div>
  );
}

// ============================================================
// ISSUE COMMUNITY   (consolidated from IssueCommunity.tsx)
// ============================================================

const issueCommunityTabs = ["Discussion", "Chat", "Polls", "Actions", "Progress", "Members", "Evidence", "Verification"] as const;
type IssueCommunityTab = (typeof issueCommunityTabs)[number];

const issueStatuses: IssueCommunityStatus[] = [
  "REPORTED",
  "COMMUNITY_VERIFIED",
  "ACTION_STARTED",
  "IN_PROGRESS",
  "AWAITING_VERIFICATION",
  "RESOLVED",
  "VERIFIED",
  "ARCHIVED",
];

const activityStatuses: VolunteerActivityStatus[] = ["OPEN", "ACTIVE", "AWAITING_VERIFICATION", "VERIFIED", "COMPLETED", "CANCELLED"];

function issueCommunityStatusText(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function issueCommunityTimeText(value: { toDate?: () => Date } | null | undefined) {
  if (!value?.toDate) return "";
  return value.toDate().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function IssueCommunityPage() {
  const { communityId } = useParams();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // Live user summary (replaces one-time getUserSummary read).
  const summary = useLiveUserSummary(user?.uid);
  const [community, setCommunity] = useState<IssueCommunity | null>(null);
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [discussion, setDiscussion] = useState<CommunityMessage[]>([]);
  const [chat, setChat] = useState<CommunityMessage[]>([]);
  const [polls, setPolls] = useState<Array<CommunityPoll & { myVote?: PollVote }>>([]);
  const [activities, setActivities] = useState<VolunteerActivity[]>([]);
  const [evidence, setEvidence] = useState<ActivityEvidence[]>([]);
  const [activeTab, setActiveTab] = useState<IssueCommunityTab>(() =>
    searchParams.get("tab") === "Verification" ? "Verification" : "Discussion"
  );
  const [messageText, setMessageText] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState("Yes\nNo");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [activityTime, setActivityTime] = useState("");
  const [activityLocation, setActivityLocation] = useState("");
  const [activityLimit, setActivityLimit] = useState("10");
  const [activityRoles, setActivityRoles] = useState("Volunteer, Organizer");
  const [actionType, setActionType] = useState<ActionTypeKey | null>(null);
  const [typeFieldValues, setTypeFieldValues] = useState<Record<string, string>>({});
  const suggestedTypes = useMemo(() => suggestedActionTypes(community?.category), [community?.category]);
  const selectedTypeMeta = actionType ? getActionType(actionType) : null;
  const formConfig = getActionFormConfig(actionType);
  const [creatingAction, setCreatingAction] = useState(false);
  const [pickedEvidenceActivityId, setPickedEvidenceActivityId] = useState<string | null>(null);
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceKind, setEvidenceKind] = useState<EvidenceTypeKey>("AFTER");
  const [beforeEvidenceUrl, setBeforeEvidenceUrl] = useState("");
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);
  const [headerViewerOpen, setHeaderViewerOpen] = useState(false);
  const [participants, setParticipants] = useState<ActivityParticipant[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [contactOrg, setContactOrg] = useState("");
  const [contactMethod, setContactMethod] = useState("");
  const [contactResult, setContactResult] = useState("");
  const [contactNextFollowup, setContactNextFollowup] = useState("");
  const [contactNotes, setContactNotes] = useState("");
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!communityId) return;
    return listenIssueCommunity(communityId, setCommunity);
  }, [communityId]);

  useEffect(() => {
    if (!communityId || !user) return;
    return listenCommunityMember(communityId, user.uid, setMember);
  }, [communityId, user]);

  useEffect(() => {
    if (!communityId) return;
    const unsubs = [
      listenCommunityMembers(communityId, setMembers),
      listenCommunityMessages(communityId, "discussion", setDiscussion),
      listenCommunityMessages(communityId, "chat", setChat),
      listenCommunityPolls(communityId, user?.uid, setPolls),
      listenVolunteerActivities(communityId, setActivities),
      listenActivityEvidence(communityId, setEvidence),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [communityId, user?.uid]);

  const canManage = member?.role === "owner" || member?.role === "organizer" || member?.role === "moderator";
  const isOwner = member?.role === "owner";
  const isMember = Boolean(member);

  // Derived: the first live action preselects the evidence target until the
  // user explicitly picks one — no sync-in-effect state copy needed.
  const evidenceActivityId = pickedEvidenceActivityId ?? activities[0]?.id ?? "";

  // Live participant list for the currently-expanded action.
  useEffect(() => {
    if (!expandedActionId) return undefined;
    return listenActivityParticipants(expandedActionId, setParticipants);
  }, [expandedActionId]);

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!communityId || !summary || !messageText.trim() || !isMember) return;
    await sendCommunityMessage({
      communityId,
      user: summary,
      text: messageText,
      kind: activeTab === "Chat" ? "chat" : "discussion",
    });
    setMessageText("");
  }

  async function handleCreatePoll(event: FormEvent) {
    event.preventDefault();
    if (!communityId || !user || !canManage || !pollQuestion.trim()) return;
    const options = pollOptions.split(/\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 6);
    if (options.length < 2) return toast.error("Add at least two options");
    await createPoll({ communityId, question: pollQuestion, options, createdBy: user.uid });
    setPollQuestion("");
    setPollOptions("Yes\nNo");
    toast.success("Poll created");
  }

  function chooseActionType(key: ActionTypeKey) {
    const meta = getActionType(key);
    setTypeFieldValues({});
    setActivityRoles(meta?.defaultRoles?.join(", ") || "Volunteer");
    setActionType(key);
  }

  async function handleCreateActivity(event: FormEvent) {
    event.preventDefault();
    if (creatingAction) return;
    if (!community || !summary || !canManage || !actionType || !activityTitle.trim()) return;
    const meta = getActionType(actionType);
    const config = getActionFormConfig(actionType);
    const typeDetails: Record<string, string> = {};
    config.fields.forEach((field) => {
      const value = typeFieldValues[field.key]?.trim();
      if (value) typeDetails[field.key] = value;
    });
    setCreatingAction(true);
    try {
      await createVolunteerActivity({
        communityId: community.id,
        issueId: community.issueId,
        title: activityTitle,
        description: activityDescription,
        category: community.category,
        organizerId: summary.uid,
        organizer: summary,
        location: config.meeting ? activityLocation || community.location || "" : "",
        meetingPoint: config.meeting ? activityLocation || community.location || "" : "",
        startDate: config.schedule ? activityDate : "",
        startTime: config.schedule ? activityTime : "",
        endDate: config.schedule ? activityDate : "",
        endTime: "",
        volunteerLimit: config.capacity ? Number(activityLimit) || 0 : 0,
        status: "OPEN",
        urgent: false,
        actionType,
        actionKind: meta?.kind || null,
        typeDetails: Object.keys(typeDetails).length > 0 ? typeDetails : null,
        roles: config.roles
          ? activityRoles.split(",").map((item) => item.trim()).filter(Boolean)
          : meta?.defaultRoles?.length
            ? meta.defaultRoles
            : ["Volunteer"],
        requirements: config.meeting ? "Bring what you need for the activity." : "",
        instructions:
          meta?.kind === "external"
            ? "An external party performs this work - volunteers coordinate and track progress safely."
            : "Coordinate in the community chat before arriving.",
        verificationMethod: "Organizer review",
        evidenceRequirements: "Upload a photo, video, or short note after the work is done.",
      });
      setActivityTitle("");
      setActivityDescription("");
      setActivityDate("");
      setActivityTime("");
      setActivityLocation("");
      setActivityLimit("10");
      setTypeFieldValues({});
      setActionType(null);
      toast.success("Volunteer action created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the action. Please try again.");
    } finally {
      setCreatingAction(false);
    }
  }

  async function uploadEvidenceFile(file: File) {
    if (evidenceUploading) return null;
    const isVideo = file.type.startsWith("video");
    const isImage = file.type.startsWith("image");
    if (!isVideo && !isImage) {
      toast.error("Please choose an image or video file.");
      return null;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("That file is larger than 15 MB. Please choose a smaller file.");
      return null;
    }
    setEvidenceUploading(true);
    try {
      const result = await uploadToCloudinary(file);
      return { url: result.secure_url, mediaType: (result.resource_type === "video" ? "video" : "image") as "image" | "video" };
    } catch {
      toast.error("Upload failed. Check your connection and try again.");
      return null;
    } finally {
      setEvidenceUploading(false);
    }
  }

  async function handleEvidenceFile(event: React.ChangeEvent<HTMLInputElement>, target: "main" | "before") {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const uploaded = await uploadEvidenceFile(file);
    if (!uploaded) return;
    const url = uploaded.url;
    if (target === "before") setBeforeEvidenceUrl(url);
    else setEvidenceUrl(url);
    toast.success("Upload complete");
  }

  async function handleSubmitEvidence(event: FormEvent) {
    event.preventDefault();
    if (!community || !summary || !evidenceActivityId || evidenceSubmitting || evidenceUploading) return;
    const description = evidenceDescription.trim();
    if (!description && !evidenceUrl && !beforeEvidenceUrl) {
      toast.error("Add a short description or media before submitting.");
      return;
    }
    setEvidenceSubmitting(true);
    const mediaUrl = evidenceUrl || undefined;
    const beforeUrl = beforeEvidenceUrl || undefined;
    const mediaType = detectMediaType(mediaUrl || beforeUrl, undefined);
    try {
      await submitActivityEvidence({
        activityId: evidenceActivityId,
        communityId: community.id,
        uid: summary.uid,
        user: summary,
        description,
        kind: toVerificationKind(evidenceKind),
        evidenceType: evidenceKind === "BEFORE" ? "BEFORE" : evidenceKind === "AFTER" ? "AFTER" : "REPORT",
        mediaUrl,
        beforeMediaUrl: evidenceKind === "BEFORE" ? beforeUrl || mediaUrl || null : null,
        afterMediaUrl: evidenceKind === "AFTER" ? mediaUrl || null : null,
        mediaType,
      });
      setEvidenceDescription("");
      setEvidenceUrl("");
      setBeforeEvidenceUrl("");
      toast.success("Evidence submitted for review");
    } catch (error) {
      console.error(error);
      toast.error("Could not submit evidence");
    } finally {
      setEvidenceSubmitting(false);
    }
  }

  if (!communityId || !community) {
    return (
      <div className="app-page">
        <div className="app-empty-state">
          <HivezLoader size="md" progress={58} label="Loading issue community" />
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
        <div className="px-4 py-3 sm:py-4">
          <div className="mb-2 flex flex-wrap items-center gap-2 sm:mb-3">
            <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[11px] font-bold uppercase text-white dark:bg-white dark:text-black sm:px-3 sm:py-1 sm:text-xs">{issueCommunityStatusText(community.status)}</span>
            {community.location && <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 sm:px-3 sm:py-1 sm:text-xs"><MapPin size={12} />{community.location}</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 sm:px-3 sm:py-1 sm:text-xs"><Users size={12} />{community.memberCount} members</span>
          </div>
          <div className="flex items-start gap-2.5 sm:gap-3">
            {community.mediaUrl && (
              <button
                onClick={() => setHeaderViewerOpen(true)}
                className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-zinc-100 ring-2 ring-transparent transition hover:ring-zinc-300 dark:bg-zinc-900 dark:hover:ring-zinc-700 sm:h-14 sm:w-14"
                aria-label="Open issue media"
              >
                {community.mediaType === "video" ? (
                  <video src={community.mediaUrl} className="h-full w-full object-cover" muted playsInline disablePictureInPicture />
                ) : (
                  <img src={community.mediaUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                )}
              </button>
            )}
            <Link to={`/issue-community/${community.id}/details`} className="group block flex-1">
              <h1 className="text-lg font-black tracking-tight text-zinc-950 transition group-hover:underline dark:text-white sm:text-xl sm:font-black md:text-2xl">{community.title}</h1>
            </Link>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-zinc-700 dark:text-zinc-300 sm:mt-2 sm:text-sm sm:leading-6">{community.description}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 sm:mt-1 sm:text-xs">@{community.owner.username}</p>
        </div>
      </header>

      {headerViewerOpen && community.mediaUrl && (
        <MediaViewer
          items={[{ src: community.mediaUrl, mediaType: community.mediaType === "video" ? "video" : "image", alt: community.title, caption: community.title }]}
          index={0}
          onClose={() => setHeaderViewerOpen(false)}
          title={community.title}
        />
      )}

      <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-xl dark:border-zinc-800 dark:bg-black/95">
        {issueCommunityTabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold transition ${activeTab === tab ? "bg-zinc-950 text-white dark:bg-white dark:text-black" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
            {tab}
          </button>
        ))}
      </nav>

      <main className="px-4 py-5">
        {(activeTab === "Discussion" || activeTab === "Chat") && (
          <IssueCommunityMessagePanel messages={activeTab === "Chat" ? chat : discussion} canPost={isMember} value={messageText} onChange={setMessageText} onSubmit={handleSendMessage} mode={activeTab} />
        )}

        {activeTab === "Polls" && (
          <section className="space-y-4">
            {canManage && (
              <form onSubmit={handleCreatePoll} className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <input value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Ask the community" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                <textarea value={pollOptions} onChange={(e) => setPollOptions(e.target.value)} className="min-h-24 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                <button className="h-10 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white dark:bg-white dark:text-black">Create poll</button>
              </form>
            )}
            {polls.map((poll) => (
              <div key={poll.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black text-zinc-950 dark:text-white">{poll.question}</h3>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      {poll.status === "OPEN" ? (
                        <button onClick={() => closePoll(poll.id)} className="text-xs font-bold text-zinc-500 hover:text-zinc-950 dark:hover:text-white">Close</button>
                      ) : (
                        <button onClick={() => reopenPoll(poll.id)} className="text-xs font-bold text-zinc-500 hover:text-zinc-950 dark:hover:text-white">Reopen</button>
                      )}
                      {isOwner && <button onClick={() => deletePoll(poll.id)} className="text-red-500 hover:text-red-400"><Trash2 size={15} /></button>}
                    </div>
                  )}
                </div>
                <div className="mt-4 space-y-2">
                  {poll.options.map((option, index) => {
                    const count = poll.counts[index] || 0;
                    const percent = poll.totalVotes ? Math.round((count / poll.totalVotes) * 100) : 0;
                    const selected = poll.myVote?.optionIndex === index;
                    return (
                      <button key={option} disabled={!isMember || Boolean(poll.myVote) || poll.status !== "OPEN"} onClick={() => user && votePoll(poll, user.uid, index).then(() => toast.success("Vote recorded"))} className={`relative h-11 w-full overflow-hidden rounded-xl border px-4 text-left text-sm font-bold disabled:cursor-default ${selected ? "border-emerald-400" : "border-zinc-200 dark:border-zinc-800"}`}>
                        <span className={`absolute inset-y-0 left-0 ${selected ? "bg-emerald-100 dark:bg-emerald-950" : "bg-zinc-100 dark:bg-zinc-900"}`} style={{ width: `${percent}%` }} />
                        <span className="relative flex justify-between"><span>{option}</span><span>{percent}%</span></span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs font-semibold text-zinc-500">{poll.totalVotes} votes • {issueCommunityStatusText(poll.status)}</p>
              </div>
            ))}
            {!polls.length && <IssueCommunityEmptyBlock text="No polls yet. Owners and organizers can create one above." />}
          </section>
        )}

        {activeTab === "Actions" && (
          <section className="space-y-4">
            {canManage && (
              <>
                {!actionType ? (
                  <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <div>
                      <p className="text-base font-black text-zinc-950 dark:text-white">What should we do?</p>
                      <p className="text-xs font-semibold text-zinc-500">Choose an action for this issue. Each action has its own focused workflow.</p>
                    </div>
                    {suggestedTypes.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Suggested for this issue</p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {suggestedTypes.map((meta) => (
                            <button
                              key={meta.key}
                              type="button"
                              onClick={() => chooseActionType(meta.key)}
                              title={meta.description}
                              className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left text-sm font-bold text-emerald-800 transition hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                            >
                              <span className="text-lg">{meta.emoji}</span>
                              <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="space-y-3">
                      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">All action types</p>
                      {ACTION_TYPE_GROUPS.map((group) => {
                        const options = ACTION_TYPES.filter((meta) => group.keys.includes(meta.key) && !suggestedTypes.some((s) => s.key === meta.key));
                        if (!options.length) return null;
                        return (
                          <div key={group.label}>
                            <p className="mb-1.5 text-[11px] font-bold text-zinc-400">{group.label}</p>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              {options.map((meta) => (
                                <button
                                  key={meta.key}
                                  type="button"
                                  onClick={() => chooseActionType(meta.key)}
                                  title={meta.description}
                                  className="flex items-center gap-2 rounded-2xl border border-zinc-200 px-3 py-2.5 text-left text-sm font-bold text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300"
                                >
                                  <span className="text-lg">{meta.emoji}</span>
                                  <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCreateActivity} className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="text-xl">{selectedTypeMeta?.emoji}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{selectedTypeMeta?.label}</p>
                          <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-zinc-500">{selectedTypeMeta?.description}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setActionType(null)} className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-bold text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300">← Change</button>
                    </div>
                    <input value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} placeholder="Action title" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                    <textarea value={activityDescription} onChange={(e) => setActivityDescription(e.target.value)} placeholder="What needs to happen?" className="min-h-20 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                {formConfig.schedule && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                        <input type="time" value={activityTime} onChange={(e) => setActivityTime(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                      </div>
                    )}
                    {formConfig.meeting && (
                      <input value={activityLocation} onChange={(e) => setActivityLocation(e.target.value)} placeholder="Location / meeting point" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                    )}
                    {formConfig.capacity && (
                      <input value={activityLimit} onChange={(e) => setActivityLimit(e.target.value)} placeholder="Volunteer limit" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                    )}
                    {formConfig.roles && (
                      <input value={activityRoles} onChange={(e) => setActivityRoles(e.target.value)} placeholder="Roles (comma separated)" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                    )}

                    {formConfig.fields.map((field) => {
                      const value = typeFieldValues[field.key] || "";
                      const setValue = (next: string) => setTypeFieldValues((prev) => ({ ...prev, [field.key]: next }));
                      const fieldClass = "h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white";
                      if (field.kind === "textarea") {
                        return (
                          <textarea key={field.key} value={value} onChange={(e) => setValue(e.target.value)} placeholder={field.label} className="min-h-20 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                        );
                      }
                      if (field.kind === "select") {
                        return (
                          <select key={field.key} value={value} onChange={(e) => setValue(e.target.value)} className={fieldClass}>
                            <option value="">{field.label}…</option>
                            {field.options?.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        );
                      }
                      return (
                        <input
                          key={field.key}
                          type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : field.kind === "time" ? "time" : "text"}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder={field.label}
                          className={fieldClass}
                        />
                      );
                    })}

                    <button disabled={!activityTitle.trim() || creatingAction} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                      {creatingAction ? (<><Loader2 size={15} className="animate-spin" /> Creating…</>) : createActionLabel(actionType)}
                    </button>
                  </form>
                )}
              </>
            )}
            {activities.map((activity) => (
              <div key={activity.id} className="space-y-2">
                <ActivityCard
                  activity={activity}
                  summary={summary}
                  canManage={canManage}
                  isOwner={isOwner}
                  isCommunityMember={isMember}
                  expanded={expandedActionId === activity.id}
                  onToggleExpand={() => { setParticipants([]); setExpandedActionId(expandedActionId === activity.id ? null : activity.id); }}
                />
                {expandedActionId === activity.id && canManage && (
                  <section className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                    <p className="text-sm font-black text-zinc-950 dark:text-white">Manage {activity.title}</p>

                    <p className="mt-3 text-xs font-black uppercase tracking-wide text-zinc-500">
                      Participants · {activity.volunteerCount}{activity.volunteerLimit ? `/${activity.volunteerLimit}` : ""}
                    </p>
                    <div className="mt-2 space-y-2">
                      {participants.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => setSelectedParticipantId(selectedParticipantId === p.id ? null : p.id)}
                          className={`flex flex-wrap items-center gap-2 rounded-2xl border p-2 ${selectedParticipantId === p.id ? "border-emerald-400 ring-2 ring-emerald-400/30" : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900"}`}
                        >
                          <img src={p.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.user.displayName)}&background=111&color=fff`} alt="" className="h-8 w-8 rounded-full object-cover" />
                          <span className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-900 dark:text-white">{p.user.displayName}</span>
                          <select
                            value={p.role}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => assignParticipantRole({ participant: p, activity, role: e.target.value, manager: summary! })
                              .then(() => toast.success("Role updated"))
                              .catch((err) => toast.error(err.message))}
                            className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-bold dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                          >
                            {(activity.roles.length ? activity.roles : ["Volunteer"]).map((role) => <option key={role} value={role}>{role}</option>)}
                          </select>
                          <select
                            value={p.participantStatus || "JOINED"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setParticipantStatus({ participant: p, activity, status: e.target.value as ParticipantStatus, manager: summary! })
                              .then(() => toast.success("Status updated"))
                              .catch((err) => toast.error(err.message))}
                            className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-bold capitalize dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
                          >
                            {(["JOINED", "CONFIRMED", "COMPLETED", "WITHDREW"] as const).map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
                          </select>
                        </div>
                      ))}
                      {!participants.length && <p className="text-xs font-semibold text-zinc-500">No one has joined this action yet.</p>}
                    </div>

                    <p className="mt-4 text-xs font-black uppercase tracking-wide text-zinc-500">Checklist</p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newTaskLabel.trim()) return;
                        addActivityTask({ activity, label: newTaskLabel })
                          .then(() => { setNewTaskLabel(""); toast.success("Task added"); })
                          .catch((err) => toast.error(err.message));
                      }}
                      className="mt-2 flex gap-2"
                    >
                      <input value={newTaskLabel} onChange={(e) => setNewTaskLabel(e.target.value)} placeholder="Add a task…" className="h-10 min-w-0 flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                      <button className="h-10 shrink-0 rounded-full bg-zinc-950 px-4 text-xs font-bold text-white dark:bg-white dark:text-black">Add</button>
                    </form>
                    {activity.tasks?.map((task, index) => (
                      <button
                        key={task.id}
                        onClick={() => toggleActivityTask({ activity, index }).catch((err) => toast.error(err.message))}
                        className={`mt-2 flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold ${task.done ? "border-emerald-300 text-zinc-400 line-through dark:border-emerald-800" : "border-zinc-200 text-zinc-800 dark:border-zinc-800 dark:text-white"}`}
                      >
                        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${task.done ? "border-emerald-400 bg-emerald-400 text-white" : "border-zinc-300 dark:border-zinc-700"}`}>{task.done && <CheckCircle2 size={13} />}</span>
                        <span className="min-w-0 flex-1">{task.label}</span>
                        <span onClick={(e) => { e.stopPropagation(); removeActivityTask({ activity, index }).catch((err) => toast.error(err.message)); }} className="text-red-500"><Trash2 size={14} /></span>
                      </button>
                    ))}
                    {!activity.tasks?.length && <p className="mt-2 text-xs font-semibold text-zinc-500">No tasks yet.</p>}

                    <p className="mt-4 text-xs font-black uppercase tracking-wide text-zinc-500">Contact & follow-up log</p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!summary) return;
                        logContactUpdate({
                          activity,
                          user: summary,
                          contactedOrg: contactOrg,
                          method: contactMethod,
                          result: contactResult,
                          nextFollowUp: contactNextFollowup,
                          notes: contactNotes,
                        })
                          .then(() => {
                            setContactOrg("");
                            setContactMethod("");
                            setContactResult("");
                            setContactNextFollowup("");
                            setContactNotes("");
                            toast.success("Contact update logged");
                          })
                          .catch((err) => toast.error(err.message));
                      }}
                      className="mt-2 grid gap-2 sm:grid-cols-2"
                    >
                      <input value={contactOrg} onChange={(e) => setContactOrg(e.target.value)} placeholder="Organization / person" className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                      <input value={contactMethod} onChange={(e) => setContactMethod(e.target.value)} placeholder="Method (call, email…)" className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                      <input value={contactResult} onChange={(e) => setContactResult(e.target.value)} placeholder="Result / status" className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                      <input value={contactNextFollowup} onChange={(e) => setContactNextFollowup(e.target.value)} placeholder="Next follow-up date" className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                      <input value={contactNotes} onChange={(e) => setContactNotes(e.target.value)} placeholder="Notes" className="h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white sm:col-span-2" />
                      <button className="h-10 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white dark:bg-white dark:text-black sm:col-span-2">Log contact update</button>
                    </form>
                  </section>
                )}
              </div>
            ))}
            {!activities.length && <IssueCommunityEmptyBlock text="No volunteer actions yet." />}
          </section>
        )}

        {activeTab === "Progress" && (
          <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-emerald-500" />
              <div>
                <h2 className="text-lg font-black text-zinc-950 dark:text-white">Community progress</h2>
                <p className="text-sm text-zinc-500">Track the issue from report to resolution.</p>
              </div>
            </div>
            {canManage && (
              <select value={community.status} onChange={(e) => updateCommunityStatus(community.id, e.target.value as IssueCommunityStatus)} className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
                {issueStatuses.map((status) => <option key={status} value={status}>{issueCommunityStatusText(status)}</option>)}
              </select>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <IssueCommunityMetric icon={<Users size={18} />} label="Members" value={community.memberCount} />
              <IssueCommunityMetric icon={<CalendarDays size={18} />} label="Actions" value={community.activityCount} />
              <IssueCommunityMetric icon={<CheckCircle2 size={18} />} label="Evidence" value={evidence.length} />
            </div>
          </section>
        )}

        {activeTab === "Members" && (
          <section className="space-y-3">
            {isOwner && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <p className="font-bold text-zinc-950 dark:text-white">Owner controls</p>
                <p className="mt-1">Promote trusted members, assign moderators, or remove people from this issue community.</p>
              </div>
            )}
            {members.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <img src={item.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.displayName)}&background=111&color=fff`} alt="" className="h-11 w-11 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{item.user.displayName}</p>
                  <p className="truncate text-xs text-zinc-500">@{item.user.username || "hivez"}</p>
                </div>
                {isOwner && item.role !== "owner" ? (
                  <div className="flex items-center gap-2">
                    <select value={item.role} onChange={(e) => updateCommunityMemberRole(item, e.target.value as CommunityMember["role"]).then(() => toast.success("Role updated")).catch((error) => toast.error(error.message))} className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-bold capitalize dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
                      {["member", "moderator", "organizer"].map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <button onClick={() => removeCommunityMember(community, item).then(() => toast.success("Member removed")).catch((error) => toast.error(error.message))} className="grid h-9 w-9 place-items-center rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"><Trash2 size={15} /></button>
                  </div>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold capitalize text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{item.role}</span>
                )}
              </div>
            ))}
          </section>
        )}

        {activeTab === "Evidence" && (
          <section className="space-y-4">
            {canManage && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <p className="font-bold text-zinc-950 dark:text-white">Evidence review</p>
                <p className="mt-1">Review submitted proof and mark it accepted or rejected so the community can track real progress.</p>
              </div>
            )}
            {isMember && activities.length > 0 && (
              <form onSubmit={handleSubmitEvidence} className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <select value={evidenceActivityId} onChange={(e) => setPickedEvidenceActivityId(e.target.value || null)} className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
                  {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
                </select>
                <div className="flex flex-wrap gap-2">
                  {(["AFTER", "BEFORE", "REPORT"] as const).map((kind) => (
                    <button key={kind} type="button" onClick={() => setEvidenceKind(kind)} className={`h-9 rounded-full px-3 text-xs font-bold transition ${evidenceKind === kind ? "bg-zinc-950 text-white dark:bg-white dark:text-black" : "border border-zinc-200 text-zinc-500 dark:border-zinc-800"}`}>
                      {kind === "AFTER" ? "After (result)" : kind === "BEFORE" ? "Before (original)" : "General report"}
                    </button>
                  ))}
                </div>
                <textarea value={evidenceDescription} onChange={(e) => setEvidenceDescription(e.target.value)} placeholder="Describe what was completed or verified" className="min-h-24 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                {evidenceKind === "BEFORE" ? (
                  <>
                    <EvidenceMediaField
                      label="Before photo / video"
                      value={beforeEvidenceUrl}
                      onChange={setBeforeEvidenceUrl}
                      onUpload={(e) => handleEvidenceFile(e, "before")}
                      uploading={evidenceUploading}
                      hint="Original condition before any work started."
                    />
                    <EvidenceMediaField
                      label="After photo / video (optional)"
                      value={evidenceUrl}
                      onChange={setEvidenceUrl}
                      onUpload={(e) => handleEvidenceFile(e, "main")}
                      uploading={evidenceUploading}
                    />
                  </>
                ) : (
                  <EvidenceMediaField
                    label={evidenceKind === "AFTER" ? "Result photo / video" : "Optional photo / video"}
                    value={evidenceUrl}
                    onChange={setEvidenceUrl}
                    onUpload={(e) => handleEvidenceFile(e, "main")}
                    uploading={evidenceUploading}
                  />
                )}
                <button disabled={evidenceSubmitting || evidenceUploading} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                  {evidenceSubmitting && <Loader2 size={15} className="animate-spin" />}
                  {evidenceSubmitting ? "Submitting…" : "Submit evidence"}
                </button>
              </form>
            )}
            <EvidenceGallery
              items={evidence}
              activities={activities}
              canManage={canManage}
              onReview={(item, status) => reviewActivityEvidence(item, status).then(() => toast.success("Evidence updated")).catch((err) => toast.error(err.message))}
            />
          </section>
        )}

        {activeTab === "Verification" && (
          <VerificationPanel
            communityId={communityId}
            evidence={evidence}
            member={member}
            summary={summary}
            activities={activities}
          />
        )}
      </main>
    </div>
  );
}

function IssueCommunityMessagePanel({ messages, canPost, value, onChange, onSubmit, mode }: { messages: CommunityMessage[]; canPost: boolean; value: string; onChange: (value: string) => void; onSubmit: (event: FormEvent) => void; mode: string }) {
  return (
    <section className="space-y-4">
      <div className="space-y-3">
        {messages.map((message) => (
          <div key={message.id} className="flex gap-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <img src={message.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.user.displayName)}&background=111&color=fff`} alt="" className="h-10 w-10 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="text-sm font-black text-zinc-950 dark:text-white">{message.user.displayName} <span className="font-semibold text-zinc-400">{issueCommunityTimeText(message.createdAt)}</span></p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700 dark:text-zinc-300">{message.text}</p>
            </div>
          </div>
        ))}
        {!messages.length && <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800">No {mode.toLowerCase()} messages yet.</div>}
      </div>
      {canPost ? (
        <form onSubmit={onSubmit} className="mt-4 flex gap-2 rounded-full border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Write in ${mode.toLowerCase()}`} className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none dark:text-white" />
          <button disabled={!value.trim()} className="grid h-10 w-10 place-items-center rounded-full bg-zinc-950 text-white disabled:opacity-50 dark:bg-white dark:text-black"><Send size={17} /></button>
        </form>
      ) : (
        <p className="mt-4 rounded-3xl bg-zinc-100 p-4 text-center text-sm font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">Join the community to post.</p>
      )}
    </section>
  );
}

function toVerificationKind(kind: EvidenceTypeKey): "BEFORE" | "AFTER" | "REPORT" | "WITNESS" | "SUPPORTING" {
  switch (kind) {
    case "BEFORE":
    case "AFTER":
      return kind;
    case "WITNESS_CONFIRMATION":
      return "WITNESS";
    case "REPORT":
      return "REPORT";
    default:
      return "SUPPORTING";
  }
}

function ActivityCard({ activity, summary, canManage, isOwner, isCommunityMember, expanded, onToggleExpand }: { activity: VolunteerActivity; summary: VolunteerUserSummary | null; canManage: boolean; isOwner: boolean; isCommunityMember: boolean; expanded: boolean; onToggleExpand: () => void }) {
  const [participant, setParticipant] = useState<ActivityParticipant | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description);
  const [location, setLocation] = useState(activity.location);
  const [startDate, setStartDate] = useState(activity.startDate);
  const [startTime, setStartTime] = useState(activity.startTime);
  const [limit, setLimit] = useState(String(activity.volunteerLimit || ""));
  const [roles, setRoles] = useState(activity.roles.join(", "));
  const joined = Boolean(participant);
  const cardFormConfig = getActionFormConfig(activity.actionType);
  const cardSummary = actionTypeSummary(activity);
  const showLimit = cardFormConfig.capacity && activity.volunteerLimit > 0;

  useEffect(() => {
    if (!summary) return;
    return listenActivityParticipant(activity.id, summary.uid, setParticipant);
  }, [activity.id, summary]);

  async function toggleJoin() {
    if (!summary || busy) return;
    setBusy(true);
    try {
      if (joined) await leaveActivity(activity, summary.uid);
      else await joinActivity(activity, summary, activity.roles[0] || "Volunteer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update activity");
    } finally {
      setBusy(false);
    }
  }

  async function saveActivity(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await updateActivityDetails(activity.id, {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        meetingPoint: location.trim(),
        startDate,
        startTime,
        volunteerLimit: Number(limit) || 0,
        roles: roles.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setEditing(false);
      toast.success("Action updated");
    } catch (error) {
      console.error(error);
      toast.error("Could not update action");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {editing ? (
        <form onSubmit={saveActivity} className="space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-24 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
          <div className="grid gap-2 sm:grid-cols-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Meeting point" className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
            <input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Volunteer limit" className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
          </div>
          <input value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="Roles" className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
          <div className="flex gap-2">
            <button disabled={busy} className="h-9 rounded-full bg-zinc-950 px-4 text-xs font-bold text-white dark:bg-white dark:text-black">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-full border border-zinc-200 px-4 text-xs font-bold dark:border-zinc-800">Cancel</button>
          </div>
        </form>
      ) : (
        <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-black text-zinc-950 dark:text-white">{activity.title}</h3>
          {getActionType(activity.actionType) && (
            <p className="mt-0.5 text-xs font-bold text-zinc-500">
              <span>{getActionType(activity.actionType)!.emoji}</span> {getActionType(activity.actionType)!.label}
            </p>
          )}
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{activity.description}</p>
          {cardSummary.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cardSummary.map((row) => (
                <span key={row.key} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  {row.label}: {row.value}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{issueCommunityStatusText(activity.status)}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
        {activity.startDate && (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><CalendarDays size={14} />{activity.startDate}</span>
        )}
        {activity.location && (
          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><MapPin size={14} />{activity.location}</span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><Users size={14} />{activity.volunteerCount}{showLimit ? `/${activity.volunteerLimit}` : ""}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={!isCommunityMember || busy} onClick={toggleJoin} className="h-10 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
          {joined ? "Leave action" : cardFormConfig.joinLabel}
        </button>
        {canManage ? (
          <>
            <select value={activity.status} onChange={(e) => updateActivityStatus(activity.id, e.target.value as VolunteerActivityStatus)} className="h-10 rounded-full border border-zinc-200 bg-white px-4 text-sm font-bold dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
              {activityStatuses.map((status) => <option key={status} value={status}>{issueCommunityStatusText(status)}</option>)}
            </select>
            <select
              value={activity.progressState || "NOT_STARTED"}
              onChange={(e) => updateActionProgress({ activity, progressState: e.target.value as ActionProgressState, actor: summary! })}
              className="h-10 rounded-full border border-zinc-200 bg-white px-4 text-sm font-bold dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              {(["NOT_STARTED", "IN_PROGRESS", "WAITING_EXTERNAL", "WAITING_PROFESSIONAL", "AWAITING_EVIDENCE", "AWAITING_VERIFICATION", "COMPLETED"] as const).map((state) => (
                <option key={state} value={state}>{progressStateLabel(state)}</option>
              ))}
            </select>
          </>
        ) : (
          activity.progressState && (
            <span className="inline-flex h-10 items-center rounded-full bg-emerald-50 px-4 text-xs font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {progressStateLabel(activity.progressState)}
            </span>
          )
        )}
        <button onClick={onToggleExpand} className="h-10 rounded-full border border-zinc-200 px-4 text-sm font-bold dark:border-zinc-800">
          {expanded ? "Hide details" : "Manage"}
        </button>
        {canManage && <button onClick={() => setEditing(true)} className="h-10 rounded-full border border-zinc-200 px-4 text-sm font-bold dark:border-zinc-800">Edit</button>}
        {isOwner && activity.status !== "CANCELLED" && <button onClick={() => updateActivityStatus(activity.id, "CANCELLED").then(() => toast.success("Action cancelled"))} className="h-10 rounded-full border border-red-200 px-4 text-sm font-bold text-red-500 dark:border-red-950">Cancel action</button>}
      </div>
        </>
      )}
    </div>
  );
}

function IssueCommunityEmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm font-semibold text-zinc-500 dark:border-zinc-800">
      {text}
    </div>
  );
}

function IssueCommunityMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-zinc-900">
      <div className="text-zinc-500">{icon}</div>
      <p className="mt-3 text-2xl font-black text-zinc-950 dark:text-white">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
function EvidenceMediaField({
  label,
  value,
  onChange,
  onUpload,
  uploading,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  uploading: boolean;
  hint?: string;
}) {
  const type = detectMediaType(value, undefined);
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-dashed border-zinc-300 px-4 text-xs font-bold text-zinc-600 transition hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Uploading…" : "Upload image / video"}
          <input type="file" accept="image/*,video/*" className="hidden" onChange={onUpload} disabled={uploading} />
        </label>
        <span className="text-[11px] font-semibold text-zinc-400">or</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste a media URL"
          className="h-10 min-w-0 flex-1 rounded-full border border-zinc-200 bg-zinc-50 px-4 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
        />
      </div>
      {hint && <p className="text-[10px] font-semibold text-zinc-400">{hint}</p>}
      {value && (
        <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          {type === "video" ? (
            <video src={value} muted playsInline preload="metadata" className="max-h-48 w-full object-cover" />
          ) : (
            <img src={value} alt="" className="max-h-48 w-full object-cover" />
          )}
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Remove ${label}`}
            className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition hover:bg-black/80"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// VOLUNTEER GROUP   (consolidated from VolunteerGroup.tsx)
// ============================================================

const volunteerGroupTabs = ["About", "Issues", "Activities", "Discussion", "Announcements", "Chat", "Members"] as const;
type VolunteerGroupTab = (typeof volunteerGroupTabs)[number];

const groupRoleColors: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  organizer: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  moderator: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  member: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
};

function groupStatusText(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function groupTimeText(value: { toDate?: () => Date } | null | undefined) {
  if (!value?.toDate) return "";
  return value.toDate().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function VolunteerGroupPage() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const summary = useLiveUserSummary(user?.uid);
  const [group, setGroup] = useState<VolunteerGroup | null>(null);
  const [member, setMember] = useState<VolunteerGroupMember | null>(null);
  const [members, setMembers] = useState<VolunteerGroupMember[]>([]);
  const [activities, setActivities] = useState<VolunteerActivity[]>([]);
  const [discussion, setDiscussion] = useState<VolunteerGroupMessage[]>([]);
  const [announcements, setAnnouncements] = useState<VolunteerGroupMessage[]>([]);
  const [chat, setChat] = useState<VolunteerGroupMessage[]>([]);
  const [allCommunities, setAllCommunities] = useState<IssueCommunity[]>([]);
  const [issues, setIssues] = useState<IssueCommunity[]>([]);
  const [activeTab, setActiveTab] = useState<VolunteerGroupTab>("About");
  const [busy, setBusy] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [linkCommunity, setLinkCommunity] = useState("");
  const [transferMemberId, setTransferMemberId] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [activityCommunityId, setActivityCommunityId] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [activityTime, setActivityTime] = useState("");
  const [activityEndDate, setActivityEndDate] = useState("");
  const [activityEndTime, setActivityEndTime] = useState("");
  const [activityLocation, setActivityLocation] = useState("");
  const [activityLimit, setActivityLimit] = useState("");
  const [actionType, setActionType] = useState<ActionTypeKey | null>(null);
  const [typeFieldValues, setTypeFieldValues] = useState<Record<string, string>>({});
  const selectedTypeMeta = getActionType(actionType);
  const formConfig = getActionFormConfig(actionType);
  const suggestedTypes = useMemo(() => {
    const community = allCommunities.find((c) => c.id === activityCommunityId);
    return suggestedActionTypes(community?.category);
  }, [activityCommunityId, allCommunities]);

  useEffect(() => {
    if (!groupId) return;
    return listenGroup(groupId, setGroup);
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !user) return;
    return listenGroupMember(groupId, user.uid, setMember);
  }, [groupId, user]);

  useEffect(() => {
    if (!groupId) return;
    return listenGroupMembers(groupId, setMembers);
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    return listenGroupActivities(groupId, setActivities);
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    const unsubs = [
      listenGroupMessages(groupId, "discussion", setDiscussion),
      listenGroupMessages(groupId, "chat", setChat),
      listenGroupMessages(groupId, "announcement", setAnnouncements),
    ];
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [groupId]);

  useEffect(() => listenOpenIssueCommunities(setAllCommunities), []);

  // Live issue communities linked to this group. Keyed on the id list (not
  // the group object) so frequent group-doc updates don't resubscribe; the
  // teardown reset keeps a group switch from showing another group's issues.
  const issueIdsKey = (group?.issueIds ?? []).join(",");
  useEffect(() => {
    if (!issueIdsKey) return undefined;
    const unsubs = issueIdsKey.split(",").map((id) =>
      onSnapshot(doc(db, "issueCommunities", id), (snap) => {
        setIssues((current) => {
          const rest = current.filter((c) => c.id !== id);
          if (!snap.exists()) return rest;
          return [...rest, { id: snap.id, ...snap.data() } as IssueCommunity];
        });
      })
    );
    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
      setIssues([]);
    };
  }, [issueIdsKey]);
const isMember = Boolean(member);
  const isOwner = member?.role === "owner";
  const isManager = Boolean(member && ["owner", "organizer"].includes(member.role));

  const linkedCommunityIds = useMemo(() => new Set(group?.issueIds || []), [group]);
  const linkable = useMemo(
    () => allCommunities.filter((c) => !linkedCommunityIds.has(c.id)),
    [allCommunities, linkedCommunityIds]
  );

  async function handleJoin() {
    if (!group || !summary || busy) return;
    setBusy(true);
    try {
      await joinVolunteerGroup(group, summary);
      toast.success(`Joined ${group.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not join group");
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!group || !member || busy) return;
    setBusy(true);
    try {
      await leaveVolunteerGroup(group, member);
      toast.success("Left group");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not leave group");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!group) return;
    await updateGroupDetails(group.id, {
      name: editName.trim(),
      description: editDescription.trim(),
      location: editLocation.trim(),
    });
    setEditing(false);
    toast.success("Group updated");
  }

  async function handleLinkIssue() {
    if (!group || !linkCommunity) return;
    await linkGroupIssue(group, linkCommunity);
    setLinkCommunity("");
    toast.success("Issue community linked");
  }

  async function handleUnlinkIssue(communityId: string) {
    if (!group) return;
    await unlinkGroupIssue(group, communityId);
  }

  async function handleRoleChange(target: VolunteerGroupMember, role: string) {
    if (!group) return;
    await updateGroupMemberRole(group, target, role as VolunteerGroupMember["role"]).then(
      () => toast.success("Role updated"),
      (error) => toast.error(error.message)
    );
  }

  async function handleRemoveMember(target: VolunteerGroupMember) {
    if (!group) return;
    await removeGroupMember(group, target).then(
      () => toast.success("Member removed"),
      (error) => toast.error(error.message)
    );
  }

  async function handleTransferOwnership() {
    if (!group || !transferMemberId) return;
    const nextOwner = members.find((m) => m.uid === transferMemberId);
    if (!nextOwner) return;
    await transferGroupOwnership(group, nextOwner);
    setTransferMemberId("");
    toast.success("Ownership transferred");
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();
    if (!group || !summary || !messageText.trim()) return;
    await sendGroupMessage({
      groupId: group.id,
      user: summary,
      text: messageText,
      kind: activeTab === "Chat" ? "chat" : "discussion",
    });
    setMessageText("");
  }

  async function handlePostAnnouncement(event: FormEvent) {
    event.preventDefault();
    if (!group || !summary || !announcementText.trim()) return;
    await sendGroupMessage({ groupId: group.id, user: summary, text: announcementText, kind: "announcement" });
    setAnnouncementText("");
    toast.success("Announcement posted");
  }

  function chooseActionType(key: ActionTypeKey) {
    setTypeFieldValues({});
    setActionType(key);
  }

  async function handleCreateActivity(event: FormEvent) {
    event.preventDefault();
    if (!group || !summary || !isManager || !actionType || !activityTitle.trim() || !activityCommunityId) return;
    const community = allCommunities.find((c) => c.id === activityCommunityId);
    const meta = getActionType(actionType);
    const config = getActionFormConfig(actionType);
    const typeDetails: Record<string, string> = {};
    config.fields.forEach((field) => {
      const value = typeFieldValues[field.key]?.trim();
      if (value) typeDetails[field.key] = value;
    });
    await createVolunteerActivity({
      communityId: activityCommunityId,
      issueId: community?.issueId || activityCommunityId,
      groupId: group.id,
      title: activityTitle,
      description: activityDescription || community?.title || "",
      category: community?.category || "community",
      organizerId: summary.uid,
      organizer: summary,
      location: config.meeting ? activityLocation || group.location : "",
      meetingPoint: config.meeting ? activityLocation || group.location : "",
      startDate: config.schedule ? activityDate : "",
      startTime: config.schedule ? activityTime : "",
      endDate: config.schedule ? activityEndDate || activityDate : "",
      endTime: config.schedule ? activityEndTime : "",
      volunteerLimit: config.capacity ? Number(activityLimit) || 0 : 0,
      status: "OPEN",
      urgent: false,
      actionType,
      actionKind: meta?.kind || null,
      typeDetails: Object.keys(typeDetails).length > 0 ? typeDetails : null,
      roles: meta?.defaultRoles?.length ? meta.defaultRoles : ["Volunteer"],
      requirements: config.meeting ? "Bring what you need for the activity." : "",
      instructions:
        meta?.kind === "external"
          ? "An external party performs this work - volunteers coordinate and track progress safely."
          : "Coordinate in the activity chat before arriving.",
      verificationMethod: "Organizer review",
      evidenceRequirements: "Upload a photo, video, or short note after the work is done.",
    });
    setActivityTitle("");
    setActivityDescription("");
    setActivityCommunityId("");
    setActivityDate("");
    setActivityTime("");
    setActivityEndDate("");
    setActivityEndTime("");
    setActivityLocation("");
    setActivityLimit("");
    setTypeFieldValues({});
    setActionType(null);
    toast.success("Volunteer action created");
  }

  if (!group) {
    return (
      <div className="app-page">
        <div className="app-empty-state">
          <HivezLoader size="md" progress={58} label="Loading volunteer group" />
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
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white sm:text-2xl">{group.name}</h1>
            {group.description && <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{group.description}</p>}
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-zinc-500">
              {group.location && (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 dark:bg-zinc-900">
                  <MapPin size={12} /> {group.location}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 dark:bg-zinc-900">
                <Users size={12} /> {group.memberCount} members
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 capitalize dark:bg-zinc-900">
                Owner: {group.owner.displayName}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isMember ? (
              <button onClick={handleLeave} disabled={busy || isOwner} className="h-10 rounded-full border border-zinc-200 px-4 text-sm font-bold text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:text-white">
                {isOwner ? "Owner" : "Leave group"}
              </button>
            ) : (
              <button onClick={handleJoin} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-bold text-white transition hover:scale-[1.02] disabled:opacity-60 dark:bg-white dark:text-black">
                <HandHeart size={16} /> Join group
              </button>
            )}
            {isManager && (
              <button
                onClick={() => {
                  setEditName(group.name);
                  setEditDescription(group.description);
                  setEditLocation(group.location);
                  setEditing(true);
                }}
                className="h-10 rounded-full border border-zinc-200 px-4 text-sm font-bold text-zinc-900 dark:border-zinc-800 dark:text-white"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {editing && (
          <form onSubmit={handleSaveEdit} className="mt-4 grid gap-3 rounded-3xl border border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Group name" className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
            <input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} placeholder="Location / area" className="h-11 rounded-2xl border border-zinc-200 bg-white px-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
            <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="What does your group do?" className="min-h-20 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none sm:col-span-2 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
            <div className="flex gap-2 sm:col-span-2">
              <button className="h-9 rounded-full bg-zinc-950 px-4 text-xs font-bold text-white dark:bg-white dark:text-black">Save</button>
            </div>
          </form>
        )}
      </header>

      <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-xl dark:border-zinc-800 dark:bg-black/95">
        {volunteerGroupTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold transition ${
              activeTab === tab
                ? "bg-zinc-950 text-white dark:bg-white dark:text-black"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>
<main className="px-4 py-5">
        {activeTab === "About" && (
          <section className="space-y-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="text-lg font-black text-zinc-950 dark:text-white">About this group</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {group.description || "This volunteer group hasn't added a description yet."}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
                  <p className="text-2xl font-black text-zinc-950 dark:text-white">{group.memberCount}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Members</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
                  <p className="text-2xl font-black text-zinc-950 dark:text-white">{activities.length}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Activities</p>
                </div>
                <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900">
                  <p className="text-2xl font-black text-zinc-950 dark:text-white">{group.issueIds.length}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Issues</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="text-sm font-black text-zinc-950 dark:text-white">Organizers</h3>
              <div className="mt-3 space-y-2">
                {members
                  .filter((m) => m.role === "owner" || m.role === "organizer")
                  .map((m) => (
                    <MemberFace key={m.id} member={m} />
                  ))}
              </div>
            </div>
          </section>
        )}

        {activeTab === "Issues" && (
          <section className="space-y-4">
            {isManager && (
              <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <select
                  value={linkCommunity}
                  onChange={(e) => setLinkCommunity(e.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
                >
                  <option value="">Link an issue community</option>
                  {linkable.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <button onClick={handleLinkIssue} disabled={!linkCommunity} className="inline-flex h-10 items-center gap-1 rounded-full bg-zinc-950 px-4 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                  <Plus size={15} /> Link
                </button>
              </div>
            )}
            {issues.map((issue) => (
              <div key={issue.id} className="flex items-start justify-between gap-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <Link to={`/issue-community/${issue.id}`} className="min-w-0">
                  <p className="font-black text-zinc-950 dark:text-white">{issue.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{issue.description}</p>
                  <p className="mt-2 text-xs font-bold text-zinc-500">{groupStatusText(issue.status)} · {issue.memberCount} members</p>
                </Link>
                {isManager && (
                  <button onClick={() => handleUnlinkIssue(issue.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            {!issues.length && (
              <GroupEmptyBlock text={isManager ? "Link an issue community your group supports." : "This group has not linked any issue communities yet."} />
            )}
          </section>
        )}
{activeTab === "Activities" && (
          <section className="space-y-4">
            {isManager && (
              <div className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <p className="text-sm font-black text-zinc-950 dark:text-white">Create a group action</p>
                <select value={activityCommunityId} onChange={(e) => setActivityCommunityId(e.target.value)} className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
                  <option value="">Linked issue community</option>
                  {issues.map((issue) => (
                    <option key={issue.id} value={issue.id}>{issue.title}</option>
                  ))}
                </select>
                {!actionType ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-base font-black text-zinc-950 dark:text-white">What should we do?</p>
                      <p className="text-xs font-semibold text-zinc-500">Choose an action for the linked issue. Each action has its own focused workflow.</p>
                    </div>
                    {suggestedTypes.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Suggested for the linked issue</p>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {suggestedTypes.map((meta) => (
                            <button
                              key={meta.key}
                              type="button"
                              onClick={() => chooseActionType(meta.key)}
                              title={meta.description}
                              className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left text-sm font-bold text-emerald-800 transition hover:border-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                            >
                              <span className="text-lg">{meta.emoji}</span>
                              <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-zinc-500">All action types</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {ACTION_TYPES.map((meta) => (
                          <button
                            key={meta.key}
                            type="button"
                            onClick={() => chooseActionType(meta.key)}
                            title={meta.description}
                            className="flex items-center gap-2 rounded-2xl border border-zinc-200 px-3 py-2.5 text-left text-sm font-bold text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300"
                          >
                            <span className="text-lg">{meta.emoji}</span>
                            <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleCreateActivity} className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="text-xl">{selectedTypeMeta?.emoji}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{selectedTypeMeta?.label}</p>
                          <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-zinc-500">{selectedTypeMeta?.description}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => setActionType(null)} className="shrink-0 rounded-full border border-zinc-200 px-3 py-1.5 text-[11px] font-bold text-zinc-600 hover:border-zinc-400 dark:border-zinc-800 dark:text-zinc-300">← Change</button>
                    </div>
                    <input value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} placeholder="Action title" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                    <textarea value={activityDescription} onChange={(e) => setActivityDescription(e.target.value)} placeholder="What needs to happen?" className="min-h-20 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                {formConfig.schedule && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                        <input type="time" value={activityTime} onChange={(e) => setActivityTime(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                        <input type="date" value={activityEndDate} onChange={(e) => setActivityEndDate(e.target.value)} placeholder="End date" className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                        <input type="time" value={activityEndTime} onChange={(e) => setActivityEndTime(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                      </div>
                    )}
                    {formConfig.meeting && (
                      <input value={activityLocation} onChange={(e) => setActivityLocation(e.target.value)} placeholder="Location" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                    )}
                    {formConfig.capacity && (
                      <input value={activityLimit} onChange={(e) => setActivityLimit(e.target.value)} placeholder="Volunteer limit" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                    )}

                    {formConfig.fields.map((field) => {
                      const value = typeFieldValues[field.key] || "";
                      const setValue = (next: string) => setTypeFieldValues((prev) => ({ ...prev, [field.key]: next }));
                      const fieldClass = "h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white";
                      if (field.kind === "textarea") {
                        return (
                          <textarea key={field.key} value={value} onChange={(e) => setValue(e.target.value)} placeholder={field.label} className="min-h-20 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                        );
                      }
                      if (field.kind === "select") {
                        return (
                          <select key={field.key} value={value} onChange={(e) => setValue(e.target.value)} className={fieldClass}>
                            <option value="">{field.label}…</option>
                            {field.options?.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                        );
                      }
                      return (
                        <input
                          key={field.key}
                          type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : field.kind === "time" ? "time" : "text"}
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          placeholder={field.label}
                          className={fieldClass}
                        />
                      );
                    })}

                    <button disabled={!activityTitle.trim()} className="h-11 w-full rounded-full bg-zinc-950 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">Create action</button>
                  </form>
                )}
              </div>
            )}
            {activities.map((activity) => (
              <GroupActivityCard key={activity.id} activity={activity} summary={summary} />
            ))}
            {!activities.length && (
              <GroupEmptyBlock text="No volunteer actions for this group yet." />
            )}
          </section>
        )}
{activeTab === "Discussion" && (
          isMember ? (
            <GroupMessagePanel
              title="Discussion"
              empty="Start the conversation."
              messages={discussion}
              value={messageText}
              onChange={setMessageText}
              onSubmit={handleSendMessage}
              canPost={true}
            />
          ) : (
            <JoinPrompt onJoin={handleJoin} />
          )
        )}

        {activeTab === "Announcements" && (
          <section className="space-y-4">
            {isManager && (
              <form onSubmit={handlePostAnnouncement} className="flex gap-2 rounded-full border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950/40">
                <input value={announcementText} onChange={(e) => setAnnouncementText(e.target.value)} placeholder="Post an important update…" className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none dark:text-white" />
                <button disabled={!announcementText.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-500 text-white disabled:opacity-50"><Send size={16} /></button>
              </form>
            )}
            {announcements.map((message) => (
              <div key={message.id} className="rounded-3xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="flex items-center gap-2">
                  <Megaphone size={15} className="text-amber-600 dark:text-amber-400" />
                  <span className="text-[11px] font-black uppercase tracking-wide text-amber-700 dark:text-amber-300">Announcement</span>
                  <span className="text-xs font-semibold text-amber-600/70 dark:text-amber-400/70">{groupTimeText(message.createdAt)}</span>
                </div>
                <h3 className="mt-2 text-sm font-black text-zinc-950 dark:text-white">{message.user.displayName}</h3>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-800 dark:text-zinc-200">{message.text}</p>
              </div>
            ))}
            {announcements.length === 0 && <GroupEmptyBlock text="No announcements yet." />}
          </section>
        )}
{activeTab === "Chat" && (
          isMember ? (
            <GroupMessagePanel
              title="Chat"
              empty="No chat messages yet."
              messages={chat}
              value={messageText}
              onChange={setMessageText}
              onSubmit={handleSendMessage}
              canPost={true}
            />
          ) : (
            <JoinPrompt onJoin={handleJoin} />
          )
        )}

        {activeTab === "Members" && (
          <section className="space-y-3">
            {isOwner && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <p className="font-bold text-zinc-950 dark:text-white">Owner controls</p>
                <p className="mt-1">Promote organizers, remove members, or transfer ownership so the group is never orphaned.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <select value={transferMemberId} onChange={(e) => setTransferMemberId(e.target.value)} className="h-9 min-w-0 flex-1 rounded-full border border-zinc-200 bg-white px-3 text-xs font-bold dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
                    <option value="">Transfer ownership to…</option>
                    {members.filter((m) => !m.user || m.uid !== group.ownerId).map((m) => (
                      <option key={m.uid} value={m.uid}>{m.user?.displayName || m.uid}</option>
                    ))}
                  </select>
                  <button onClick={handleTransferOwnership} disabled={!transferMemberId} className="h-9 rounded-full bg-zinc-950 px-4 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">Transfer</button>
                </div>
              </div>
            )}
            {members.map((item) => (
              <GroupMemberRow
                key={item.id}
                item={item}
                isOwner={isOwner}
                group={group}
                onRoleChange={handleRoleChange}
                onRemove={handleRemoveMember}
              />
            ))}
            {!members.length && <GroupEmptyBlock text="No members yet." />}
          </section>
        )}
      </main>
    </div>
  );
}
function MemberFace({ member }: { member: VolunteerGroupMember }) {
  const liveUser = useLiveProfile(member.uid, member.user) || member.user;
  return (
    <div className="flex items-center gap-3">
      <img
        src={liveUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(liveUser.displayName || "Hivez")}&background=111&color=fff`}
        alt=""
        className="h-9 w-9 rounded-full object-cover"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-zinc-950 dark:text-white">{liveUser.displayName}</p>
        <p className="truncate text-xs text-zinc-500">@{liveUser.username || "hivez"}</p>
      </div>
      <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${groupRoleColors[member.role] || groupRoleColors.member}`}>
        {member.role}
      </span>
    </div>
  );
}

function GroupEmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm font-semibold text-zinc-500 dark:border-zinc-800">
      {text}
    </div>
  );
}

function JoinPrompt({ onJoin }: { onJoin: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-800">
      <HandHeart className="mx-auto mb-3 text-zinc-400" size={32} />
      <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Join this group to participate in discussion and chat.</p>
      <button onClick={onJoin} className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white dark:bg-white dark:text-black">
        <HandHeart size={15} /> Join group
      </button>
    </div>
  );
}

function GroupMessagePanel({ messages, value, onChange, onSubmit, canPost, title, empty }: {
  messages: VolunteerGroupMessage[];
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  canPost: boolean;
  title: string;
  empty: string;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-3">
        {messages.map((message) => (
          <div key={message.id} className="flex gap-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <img src={message.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.user.displayName)}&background=111&color=fff`} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="text-sm font-black text-zinc-950 dark:text-white">
                {message.user.displayName} <span className="font-semibold text-zinc-400">{groupTimeText(message.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700 dark:text-zinc-300">{message.text}</p>
            </div>
          </div>
        ))}
        {!messages.length && <GroupEmptyBlock text={empty} />}
      </div>
      {canPost ? (
        <form onSubmit={onSubmit} className="flex gap-2 rounded-full border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={`Write in ${title.toLowerCase()}`} className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none dark:text-white" />
          <button disabled={!value.trim()} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-zinc-950 text-white disabled:opacity-50 dark:bg-white dark:text-black">
            <Send size={17} />
          </button>
        </form>
      ) : (
        <p className="rounded-3xl bg-zinc-100 p-4 text-center text-sm font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">Join the group to post.</p>
      )}
    </section>
  );
}
function GroupActivityCard({ activity, summary }: { activity: VolunteerActivity; summary: VolunteerUserSummary | null }) {
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!summary) return;
    return listenActivityParticipant(activity.id, summary.uid, (participant) => {
      setJoined(Boolean(participant));
    });
  }, [activity.id, summary]);

  async function toggleJoin() {
    if (!summary || busy) return;
    setBusy(true);
    try {
      if (joined) await leaveActivity(activity, summary.uid, summary);
      else await joinActivity(activity, summary, activity.roles[0] || "Volunteer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update activity");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-zinc-950 dark:text-white">{activity.title}</p>
          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{activity.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{groupStatusText(activity.status)}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><CalendarDays size={13} />{formatScheduleText(activity)}</span>
        {activity.location && <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><MapPin size={13} />{activity.location}</span>}
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><Users size={13} />{activity.volunteerCount}{activity.volunteerLimit ? `/${activity.volunteerLimit}` : ""}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={() => void toggleJoin()} disabled={!summary || busy || activity.status === "CANCELLED"} className="h-9 rounded-full bg-zinc-950 px-4 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
          {joined ? "Leave action" : "Join action"}
        </button>
        <Link to={`/issue-community/${activity.communityId}`} className="h-9 rounded-full border border-zinc-200 px-4 text-xs font-bold text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
          Open community
        </Link>
      </div>
    </div>
  );
}

function GroupMemberRow({ item, isOwner, onRoleChange, onRemove }: {
  item: VolunteerGroupMember;
  isOwner: boolean;
  group?: VolunteerGroup;
  onRoleChange: (member: VolunteerGroupMember, role: string) => void;
  onRemove: (member: VolunteerGroupMember) => void;
}) {
  const liveUser = useLiveProfile(item.uid, item.user) || item.user;
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <img src={liveUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(liveUser.displayName || "Hivez")}&background=111&color=fff`} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-zinc-950 dark:text-white">{liveUser.displayName}</p>
        <p className="truncate text-xs text-zinc-500">@{liveUser.username || "hivez"}</p>
      </div>
      {isOwner && item.role !== "owner" ? (
        <div className="flex items-center gap-2">
          <select value={item.role} onChange={(e) => onRoleChange(item, e.target.value)} className="h-9 rounded-full border border-zinc-200 bg-white px-3 text-xs font-bold capitalize dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
            {["member", "organizer"].map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
          <button onClick={() => onRemove(item)} className="grid h-9 w-9 place-items-center rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
            <Trash2 size={15} />
          </button>
        </div>
      ) : (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${groupRoleColors[item.role] || groupRoleColors.member}`}>{item.role}</span>
      )}
    </div>
  );
}
// ============================================================
// VERIFICATION PANEL (mounted by Issue Community)   (consolidated from VerificationPanel.tsx)
// ============================================================

function verificationStatusText(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

const statusStyles: Record<string, string> = {
  VERIFIED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
  DISPUTED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  NEEDS_MORE_EVIDENCE: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  SUBMITTED: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  UNDER_REVIEW: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  PARTIALLY_CONFIRMED: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};
/** One verification case for a community: progress, evidence comparison,
 *  reviewer decisions, supporting signals and the full audit timeline. */
function VerificationPanel({ communityId, evidence, member, summary, activities }: {
  communityId: string;
  evidence: ActivityEvidence[];
  member: CommunityMember | null;
  summary: VolunteerUserSummary | null;
  activities: VolunteerActivity[];
}) {
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [decisions, setDecisions] = useState<VerificationDecision[]>([]);
  const [events, setEvents] = useState<VerificationCaseEvent[]>([]);
  const [witnesses, setWitnesses] = useState<WitnessConfirmation[]>([]);
  const [communityConfirmations, setCommunityConfirmations] = useState<CommunityConfirmation[]>([]);

  const [decision, setDecision] = useState<ReviewerDecision | "">("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [witnessText, setWitnessText] = useState("");
  const [witnessMediaUrl, setWitnessMediaUrl] = useState("");
  const [confirmResolved, setConfirmResolved] = useState(true);
  const [reopenReason, setReopenReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Ticking clock (minute resolution) so deadline comparisons never run during render.
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    const timeout = setTimeout(tick, 0);
    const interval = setInterval(tick, 60_000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => listenVerificationCases(communityId, setCases), [communityId]);

  const caseId = cases[0]?.id || null;

  useEffect(() => {
    if (!caseId) return;
    const unsubs = [
      listenVerificationDecisions(caseId, setDecisions),
      listenVerificationEvents(caseId, setEvents),
      listenWitnessConfirmations(caseId, setWitnesses),
      listenCommunityConfirmations(caseId, setCommunityConfirmations),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [caseId]);

  const caseData = cases[0] || null;
  const canManage = member?.role === "owner" || member?.role === "organizer" || member?.role === "moderator";
  const canDecide = Boolean(
    caseData &&
    summary &&
    isCaseReviewable(caseData.status) &&
    (caseData.primaryReviewerId === summary.uid || caseData.eligibleReviewerIds.includes(summary.uid))
  );

  const myDecision = useMemo(
    () => (summary ? decisions.find((d) => d.reviewerId === summary.uid) : undefined),
    [decisions, summary]
  );
  const myWitness = useMemo(
    () => (summary ? witnesses.find((w) => w.uid === summary.uid) : undefined),
    [witnesses, summary]
  );
  const myCommunityConfirmation = useMemo(
    () => (summary ? communityConfirmations.find((c) => c.uid === summary.uid) : undefined),
    [communityConfirmations, summary]
  );
  const confidence: VerificationConfidenceLevel | null = useMemo(
    () =>
      caseData
        ? computeVerificationConfidence({
            caseData,
            decisions,
            evidence,
            communityConfirmations: caseData.communityConfirmations || 0,
            witnessConfirmations: caseData.witnessConfirmations || 0,
          })
        : null,
    [caseData, decisions, evidence]
  );
  const ownerHasDecided = useMemo(
    () => Boolean(caseData?.primaryReviewerId && decisions.some((d) => d.reviewerId === caseData.primaryReviewerId)),
    [caseData, decisions]
  );
  const deadlinePassed = Boolean(
    nowMs > 0 && caseData?.ownerResponseDeadline && nowMs > caseData.ownerResponseDeadline
  );
async function handleReviewerDecision(event: FormEvent) {
    event.preventDefault();
    if (!caseData || !summary || !decision) return;
    if (decision !== "APPROVE" && !reason.trim()) {
      toast.error("Please choose a reason for this decision.");
      return;
    }
    setBusy("review");
    try {
      await submitReviewerDecision({
        caseData,
        reviewer: summary,
        decision,
        reason: reason.trim() || null,
        comments: comment.trim() || null,
      });
      toast.success("Decision recorded on the verification case.");
      setDecision("");
      setReason("");
      setComment("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record the decision.");
    } finally {
      setBusy(null);
    }
  }

  async function handleWitnessSubmit(event: FormEvent) {
    event.preventDefault();
    if (!caseData || !summary || !witnessText.trim()) return;
    setBusy("witness");
    try {
      await submitWitnessConfirmation({
        caseData,
        user: summary,
        text: witnessText,
        mediaUrl: witnessMediaUrl || undefined,
        mediaType: witnessMediaUrl ? "image" : "text",
      });
      setWitnessText("");
      setWitnessMediaUrl("");
      toast.success("Witness confirmation recorded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit witness confirmation.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCommunityConfirm() {
    if (!caseData || !summary) return;
    setBusy("community");
    try {
      await submitCommunityConfirmation({
        caseData,
        user: summary,
        resolved: confirmResolved,
        note: comment.trim() || undefined,
      });
      setComment("");
      toast.success("Community confirmation recorded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to submit confirmation.");
    } finally {
      setBusy(null);
    }
  }

  async function handleActivateFallback() {
    if (!caseData || !summary || !deadlinePassed || ownerHasDecided) return;
    setBusy("fallback");
    try {
      await activateFallbackVerification(caseData, summary);
      toast.success("Fallback verification activated - eligible reviewers can now decide.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to activate fallback.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReopen() {
    if (!caseData || !summary) return;
    setBusy("reopen");
    try {
      await reopenVerificationCase(caseData, summary, reopenReason.trim());
      setReopenReason("");
      toast.success("Verification case reopened.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reopen the case.");
    } finally {
      setBusy(null);
    }
  }
return (
    <section className="space-y-4">
      {!caseData ? (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <ShieldCheck size={28} className="mx-auto text-zinc-400" />
          <h3 className="mt-3 font-black text-zinc-950 dark:text-white">Community verification</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
            A verification case is created automatically when volunteers submit completion
            evidence. The post owner reviews it together with authorized community reviewers,
            and the issue is only marked verified after the required confirmations are met.
          </p>
        </div>
      ) : (
        <CaseOverview caseData={caseData} confidence={confidence} deadlinePassed={deadlinePassed} ownerHasDecided={ownerHasDecided} activities={activities} />
      )}

      {caseData && (
        <>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
            <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">Reviewed by {caseData.reviewerQuorum || 0} eligible source{caseData.reviewerQuorum === 1 ? "" : "s"}</span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">{caseData.evidenceIds.length} evidence submission{caseData.evidenceIds.length === 1 ? "" : "s"}</span>
            <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">{communityConfirmations.length} community & {witnesses.length} witness signals</span>
          </div>

          {caseData.evidenceIds.length > 0 && evidence.length > 0 && (
            <EvidenceComparison evidence={evidence} />
          )}

          {isCaseReviewable(caseData.status) && canDecide && (
            <ReviewerDecisionPanel
              myDecision={myDecision}
              decision={decision}
              onDecision={setDecision}
              reason={reason}
              onReason={setReason}
              comment={comment}
              onComment={setComment}
              onSubmit={handleReviewerDecision}
              busy={busy === "review"}
            />
          )}

          <SupportSignalsPanel
            caseData={caseData}
            summary={summary}
            isMember={Boolean(member)}
            witnesses={witnesses}
            communityConfirmations={communityConfirmations}
            myWitness={myWitness}
            myCommunityConfirmation={myCommunityConfirmation}
            witnessText={witnessText}
            setWitnessText={setWitnessText}
            witnessMediaUrl={witnessMediaUrl}
            confirmResolved={confirmResolved}
            setConfirmResolved={setConfirmResolved}
            comment={comment}
            setComment={setComment}
            onWitnessSubmit={handleWitnessSubmit}
            onCommunityConfirm={handleCommunityConfirm}
            busy={busy}
            onPickWitnessMedia={async (file: File) => {
              try {
                const result = await uploadToCloudinary(file);
                setWitnessMediaUrl(result.secure_url);
              } catch {
                toast.error("Media upload failed.");
              }
            }}
          />

          {canManage && (
            <ManagerPanel
              caseData={caseData}
              deadlinePassed={deadlinePassed}
              ownerHasDecided={ownerHasDecided}
              onActivateFallback={handleActivateFallback}
              reopenReason={reopenReason}
              setReopenReason={setReopenReason}
              onReopen={handleReopen}
              busy={busy === "fallback" || busy === "reopen"}
            />
          )}

          <TimelinePanel events={events} decisions={decisions} />
        </>
      )}
    </section>
  );
}
function CaseOverview({ caseData, confidence, deadlinePassed, ownerHasDecided, activities }: {
  caseData: VerificationCase;
  confidence: VerificationConfidenceLevel | null;
  deadlinePassed: boolean;
  ownerHasDecided?: boolean;
  activities: VolunteerActivity[];
}) {
  const linkedActivity = activities.find((a) => a.id === caseData.activityId);
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-zinc-500" />
          <h3 className="font-black text-zinc-950 dark:text-white">Verification case</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${statusStyles[caseData.status] || "bg-zinc-100 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300"}`}>
          {verificationCaseStatusLabel(caseData.status)}
        </span>
      </div>

      {caseData.fallbackActivated ? (
        <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-950 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>
            The owner response window expired, so the eligible reviewer quorum now decides this
            case (no single owner approval required).
          </p>
        </div>
      ) : caseData.ownerResponseDeadline ? (
        <p className="mt-3 flex items-center gap-2 rounded-2xl bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
          <Clock size={13} />
          {deadlinePassed
            ? "Owner response window has passed."
            : ownerHasDecided
              ? "The post owner has already responded."
              : `Waiting on the post owner's verdict until ${new Date(caseData.ownerResponseDeadline).toLocaleString([], { month: "short", day: "numeric" })}.`}
        </p>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <VerificationMetric label="Approvals" value={`${caseData.approvalCount} / ${caseData.requiredApprovals}`} tone="ok" />
        <VerificationMetric label="Rejections" value={`${caseData.rejectionCount} / ${caseData.requiredRejections}`} tone="bad" />
        <VerificationMetric label="More evidence" value={`${caseData.moreEvidenceCount}`} tone="info" />
        <VerificationMetric label="Template" value={caseData.verificationTemplate ? verificationStatusText(caseData.verificationTemplate) : "standard"} tone="plain" />
      </div>

      {confidence && (
        <p className="mt-3 text-xs text-zinc-500">
          Verification confidence (from real case data only):{" "}
          <span className={`font-black uppercase ${confidence === "HIGH" ? "text-emerald-600 dark:text-emerald-400" : confidence === "MODERATE" ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400"}`}>{confidence}</span>
        </p>
      )}

      {linkedActivity && (
        <p className="mt-2 text-xs font-semibold text-zinc-500">
          Linked action: {linkedActivity.title}
        </p>
      )}
      {caseData.disputeNote && (
        <p className="mt-2 text-xs font-semibold text-amber-600 dark:text-amber-400">{caseData.disputeNote}</p>
      )}
    </div>
  );
}

function VerificationMetric({ label, value, tone }: { label: string; value: string; tone: "ok" | "bad" | "info" | "plain" }) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "text-red-500 dark:text-red-400"
        : tone === "info"
          ? "text-sky-600 dark:text-sky-400"
          : "text-zinc-950 dark:text-white";
  return (
    <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
      <p className={`text-lg font-black ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
function ReviewerDecisionPanel({ myDecision, decision, onDecision, reason, onReason, comment, onComment, onSubmit, busy }: {
  myDecision?: VerificationDecision;
  decision: ReviewerDecision | "";
  onDecision: (d: ReviewerDecision | "") => void;
  reason: string;
  onReason: (v: string) => void;
  comment: string;
  onComment: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  busy?: boolean;
}) {
  if (myDecision) {
    return (
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Your review</p>
        <p className="mt-1 text-sm font-black text-zinc-950 dark:text-white">
          {reviewerDecisionLabel(myDecision.decision)}
        </p>
        {myDecision.reason && <p className="mt-0.5 text-xs text-zinc-500">{myDecision.reason}</p>}
        {myDecision.comments && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{myDecision.comments}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={16} className="text-zinc-500" />
        <p className="text-sm font-black text-zinc-950 dark:text-white">
          Your review
          <span className="font-semibold text-zinc-500"> — confirming fixed means you personally verified the issue appears resolved.</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onDecision("APPROVE")}
          className={`flex h-9 items-center gap-1 rounded-full px-4 text-xs font-bold transition ${decision === "APPROVE" ? "bg-emerald-600 text-white" : "border border-zinc-200 dark:border-zinc-800"}`}>
          <CheckCircle2 size={13} /> Confirm fixed
        </button>
        <button
          type="button"
          onClick={() => onDecision("REJECT")}
          className={`flex h-9 items-center gap-1 rounded-full px-4 text-xs font-bold transition ${decision === "REJECT" ? "bg-red-600 text-white" : "border border-zinc-200 dark:border-zinc-800"}`}>
          <XCircle size={13} /> Reject
        </button>
        <button
          type="button"
          onClick={() => onDecision("MORE_EVIDENCE")}
          className={`flex h-9 items-center gap-1 rounded-full px-4 text-xs font-bold transition ${decision === "MORE_EVIDENCE" ? "bg-amber-500 text-white" : "border border-zinc-200 dark:border-zinc-800"}`}>
          <MessageSquare size={13} /> Request more evidence
        </button>
      </div>

      {decision && decision !== "APPROVE" && (
        <select value={reason} onChange={(e) => onReason(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
          <option value="">Choose a reason…</option>
          {(decision === "REJECT" ? REJECT_REASONS : MORE_EVIDENCE_REASONS).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      )}

      <textarea value={comment} onChange={(e) => onComment(e.target.value)} placeholder="Optional details for the record (visible to all members)…" className="min-h-16 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />

      <button disabled={!decision || busy} className="h-10 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
        Submit review
      </button>
    </form>
  );
}
function EvidenceComparison({ evidence }: { evidence: ActivityEvidence[] }) {
  const before = evidence.find((e) => e.kind === "BEFORE" || Boolean(e.beforeMediaUrl));
  const after = evidence.find((e) => e.kind === "AFTER" || Boolean(e.afterMediaUrl) || (e.kind !== "BEFORE" && Boolean(e.mediaUrl) && e !== before));

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <Eye size={16} className="text-zinc-500" />
        <h4 className="text-sm font-black text-zinc-950 dark:text-white">
          Evidence comparison {evidence.length === 0 ? "" : `(${evidence.length} submission${evidence.length === 1 ? "" : "s"})`}
        </h4>
      </div>

      {(before || after) ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
            {(before?.beforeMediaUrl || before?.mediaUrl) ? (
              <img src={before?.beforeMediaUrl || before?.mediaUrl} alt="Before" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-36 items-center justify-center text-[11px] font-bold uppercase text-zinc-400">Before</div>
            )}
            <p className="px-3 py-2 text-[11px] font-bold uppercase text-zinc-500">Before</p>
          </div>
          <div className="overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-900">
            {(after?.afterMediaUrl || after?.mediaUrl) ? (
              <img src={after?.afterMediaUrl || after?.mediaUrl} alt="After" className="h-36 w-full object-cover" />
            ) : (
              <div className="flex h-36 items-center justify-center text-[11px] font-bold uppercase text-zinc-400">After</div>
            )}
            <p className="px-3 py-2 text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-400">After</p>
          </div>
        </div>
      ) : null}

      {evidence.length > 0 && (
        <div className="mt-3 space-y-2">
          {evidence.map((item) => (
            <div key={item.id} className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-black text-zinc-950 dark:text-white">
                  {item.user.displayName}
                  <span className="ml-1 font-semibold text-zinc-500">{item.kind ? `• ${verificationStatusText(item.kind)}` : ""}</span>
                </p>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-500 dark:bg-zinc-800">{verificationStatusText(item.status)}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{item.description}</p>
              {item.completedAt && <p className="mt-1 text-[11px] font-semibold text-zinc-500">Completed {item.completedAt}</p>}
              {item.afterMediaUrl && <img src={item.afterMediaUrl} alt="" className="mt-2 max-h-40 rounded-xl object-cover" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function SupportSignalsPanel({ caseData, summary, isMember, witnesses, communityConfirmations, myWitness, myCommunityConfirmation, witnessText, setWitnessText, witnessMediaUrl, confirmResolved, setConfirmResolved, comment, setComment, onWitnessSubmit, onCommunityConfirm, busy, onPickWitnessMedia }: {
  caseData: VerificationCase;
  summary: VolunteerUserSummary | null;
  isMember: boolean;
  witnesses: WitnessConfirmation[];
  communityConfirmations: CommunityConfirmation[];
  myWitness?: WitnessConfirmation;
  myCommunityConfirmation?: CommunityConfirmation;
  witnessText: string;
  setWitnessText: (v: string) => void;
  witnessMediaUrl: string;
  confirmResolved: boolean;
  setConfirmResolved: (v: boolean) => void;
  comment: string;
  setComment: (v: string) => void;
  onWitnessSubmit: (e: FormEvent) => void;
  onCommunityConfirm: () => void;
  busy: string | null;
  onPickWitnessMedia: (file: File) => void;
}) {
  const resolvedCount = communityConfirmations.filter((c) => c.resolved).length;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-zinc-500" />
            <h4 className="text-sm font-black text-zinc-950 dark:text-white">Community confirmations</h4>
          </div>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            {resolvedCount}{communityConfirmations.length > resolvedCount ? ` / ${communityConfirmations.length}` : ""}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Members who visited the location can confirm the issue looks resolved (supporting signal only).</p>

        {communityConfirmations.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {communityConfirmations.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                {c.resolved
                  ? <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                  : <XCircle size={13} className="shrink-0 text-red-400" />}
                <p className="min-w-0 truncate text-zinc-600 dark:text-zinc-400">
                  <span className="font-black text-zinc-950 dark:text-white">{c.user.displayName}</span>
                  {c.note ? ` — ${c.note}` : ""}
                </p>
                <span className="ml-auto shrink-0 text-[10px] font-semibold text-zinc-400">{verificationTimeText(c.createdAt)}</span>
              </div>
            ))}
          </div>
        )}

        {isMember && summary && (
          <div className="mt-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
            {myCommunityConfirmation ? (
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                You confirmed this issue {myCommunityConfirmation.resolved ? "looks resolved" : "still looks open"}.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setConfirmResolved(true)} className={`h-8 rounded-full px-3 text-xs font-bold transition ${confirmResolved ? "bg-emerald-600 text-white" : "border border-zinc-200 dark:border-zinc-800"}`}>Looks resolved</button>
                  <button type="button" onClick={() => setConfirmResolved(false)} className={`h-8 rounded-full px-3 text-xs font-bold transition ${!confirmResolved ? "bg-red-600 text-white" : "border border-zinc-200 dark:border-zinc-800"}`}>Still open</button>
                </div>
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional note…" className="mt-2 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
                <button onClick={onCommunityConfirm} disabled={busy === "community"} className="mt-2 h-9 rounded-full bg-zinc-950 px-4 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                  Submit confirmation
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Camera size={15} className="text-zinc-500" />
            <h4 className="text-sm font-black text-zinc-950 dark:text-white">Witness confirmations</h4>
          </div>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{caseData.witnessConfirmations || 0}</span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">Volunteers who performed the work can provide first-hand witness evidence.</p>
{witnesses.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {witnesses.map((w) => (
              <div key={w.id} className="text-xs text-zinc-600 dark:text-zinc-400">
                <p><span className="font-black text-zinc-950 dark:text-white">{w.user.displayName}</span> — {w.text}</p>
                {w.mediaUrl && <img src={w.mediaUrl} alt="" className="mt-1 max-h-32 rounded-xl object-cover" />}
              </div>
            ))}
          </div>
        )}

        {isMember && summary && !myWitness && (
          <form onSubmit={onWitnessSubmit} className="mt-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
            <textarea value={witnessText} onChange={(e) => setWitnessText(e.target.value)} placeholder="What did you witness, and when?" className="min-h-16 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
            <div className="mt-2 flex items-center gap-2">
              {witnessMediaUrl ? (
                <img src={witnessMediaUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <label className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 dark:border-zinc-800">
                  <Camera size={14} />
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPickWitnessMedia(file);
                  }} />
                </label>
              )}
              <button disabled={!witnessText.trim() || busy === "witness"} className="h-9 rounded-full bg-zinc-950 px-4 text-xs font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                Add witness note
              </button>
            </div>
          </form>
        )}
        {myWitness && <p className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400">You shared a witness confirmation.</p>}
      </div>
    </div>
  );
}
function ManagerPanel({ caseData, deadlinePassed, ownerHasDecided, onActivateFallback, reopenReason, setReopenReason, onReopen, busy }: {
  caseData: VerificationCase;
  deadlinePassed: boolean;
  ownerHasDecided: boolean;
  onActivateFallback: () => void;
  reopenReason: string;
  setReopenReason: (v: string) => void;
  onReopen: () => void;
  busy: boolean;
}) {
  const closed = caseData.status === "VERIFIED" || caseData.status === "REJECTED";
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <Zap size={15} className="text-zinc-500" />
        <h4 className="text-sm font-black text-zinc-950 dark:text-white">Manager controls</h4>
      </div>

      {!caseData.fallbackActivated && !ownerHasDecided && deadlinePassed && isCaseReviewable(caseData.status) && (
        <div className="mt-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            The owner has not responded. You can close the owner window and let the eligible
            reviewer quorum decide this case.
          </p>
          <button onClick={onActivateFallback} disabled={busy} className="mt-2 h-9 rounded-full bg-amber-500 px-4 text-xs font-bold text-white disabled:opacity-50">
            Activate fallback verification
          </button>
        </div>
      )}

      {closed && (
        <div className="mt-3 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-900">
          <input value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Reason for reopening…" className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white" />
          <button onClick={onReopen} disabled={busy || !reopenReason.trim()} className="mt-2 flex h-9 items-center gap-1.5 rounded-full border border-zinc-200 px-4 text-xs font-bold disabled:opacity-50 dark:border-zinc-800">
            <RotateCcw size={13} /> Reopen verification case
          </button>
        </div>
      )}
    </div>
  );
}

function TimelinePanel({ events, decisions }: { events: VerificationCaseEvent[]; decisions: VerificationDecision[] }) {
  const fallbackTimeline = events.length === 0
    ? decisions.map((d) => ({ id: d.id, eventType: d.decision as VerificationCaseEvent["eventType"], text: `${d.reviewer.displayName} ${d.decision.toLowerCase().replace("_", " ")}`, createdAt: d.createdAt }))
    : [];
  const rows = events.length > 0 ? events : fallbackTimeline;

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center gap-2">
        <Clock size={15} className="text-zinc-500" />
        <h4 className="text-sm font-black text-zinc-950 dark:text-white">Verification timeline</h4>
      </div>
      {rows.length > 0 ? (
        <div className="mt-3 space-y-2.5">
          {rows.map((row) => (
            <div key={row.id} className="flex items-start gap-2.5">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-zinc-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs leading-5 text-zinc-700 dark:text-zinc-300">{row.text}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{verificationTimeText(row.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs font-semibold text-zinc-500">No verification activity yet.</p>
      )}
    </div>
  );
}
// ============================================================
// EXPORTS
// ============================================================

export {
  Volunteering as VolunteeringPage,
  MyVolunteering as MyVolunteeringPage,
  CommunityDetails as CommunityDetailsPage,
  IssueCommunityPage,
  VolunteerGroupPage,
  VerificationPanel as VerificationPanelPage,
};
export default Volunteering;
