import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  HandHeart,
  MapPin,
  Megaphone,
  Plus,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import HivezLoader from "@/components/common/HivezLoader";
import { useAuth } from "@/context/AuthContext";
import { useLiveProfile, useLiveUserSummary } from "@/hooks/useLiveProfile";
import {
  createVolunteerActivity,
  joinActivity,
  joinVolunteerGroup,
  leaveActivity,
  leaveVolunteerGroup,
  linkGroupIssue,
  listenActivityParticipant,
  listenGroup,
  listenGroupActivities,
  listenGroupMember,
  listenGroupMembers,
  listenGroupMessages,
  listenOpenIssueCommunities,
  removeGroupMember,
  sendGroupMessage,
  transferGroupOwnership,
  unlinkGroupIssue,
  updateGroupDetails,
  updateGroupMemberRole,
} from "@/services/volunteering";
import { formatScheduleText } from "@/utils/volunteering";
import { ACTION_TYPES, getActionFormConfig, getActionType, suggestedActionTypes } from "@/utils/actionTypes";
import type {
  ActionTypeKey,
  IssueCommunity,
  VolunteerActivity,
  VolunteerGroup,
  VolunteerGroupMember,
  VolunteerGroupMessage,
  VolunteerUserSummary,
} from "@/types/volunteering";

const tabs = ["About", "Issues", "Activities", "Discussion", "Announcements", "Chat", "Members"] as const;
type Tab = (typeof tabs)[number];

const roleColors: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  organizer: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  moderator: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  member: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
};

function pretty(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function timeText(value: any) {
  if (!value?.toDate) return "";
  return value.toDate().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function VolunteerGroupPage() {
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
  const [activeTab, setActiveTab] = useState<Tab>("About");
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

  // Live issue communities linked to this group (one listener per link).
  useEffect(() => {
    if (!group) {
      setIssues([]);
      return;
    }
    const unsubs = group.issueIds.map((id) =>
      onSnapshot(doc(db, "issueCommunities", id), (snap) => {
        setIssues((current) => {
          const rest = current.filter((c) => c.id !== id);
          if (!snap.exists()) return rest;
          return [...rest, { id: snap.id, ...snap.data() } as IssueCommunity];
        });
      })
    );
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [group]);
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
    } catch (error: any) {
      toast.error(error?.message || "Could not join group");
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
    } catch (error: any) {
      toast.error(error?.message || "Could not leave group");
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
        {tabs.map((tab) => (
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
                  <p className="mt-2 text-xs font-bold text-zinc-500">{pretty(issue.status)} · {issue.memberCount} members</p>
                </Link>
                {isManager && (
                  <button onClick={() => handleUnlinkIssue(issue.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
            {!issues.length && (
              <EmptyBlock text={isManager ? "Link an issue community your group supports." : "This group has not linked any issue communities yet."} />
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
              <EmptyBlock text="No volunteer actions for this group yet." />
            )}
          </section>
        )}
{activeTab === "Discussion" && (
          isMember ? (
            <MessagePanel
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
                  <span className="text-xs font-semibold text-amber-600/70 dark:text-amber-400/70">{timeText(message.createdAt)}</span>
                </div>
                <h3 className="mt-2 text-sm font-black text-zinc-950 dark:text-white">{message.user.displayName}</h3>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-800 dark:text-zinc-200">{message.text}</p>
              </div>
            ))}
            {announcements.length === 0 && <EmptyBlock text="No announcements yet." />}
          </section>
        )}
{activeTab === "Chat" && (
          isMember ? (
            <MessagePanel
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
            {!members.length && <EmptyBlock text="No members yet." />}
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
      <span className={`ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${roleColors[member.role] || roleColors.member}`}>
        {member.role}
      </span>
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

function MessagePanel({ messages, value, onChange, onSubmit, canPost, title, empty }: {
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
                {message.user.displayName} <span className="font-semibold text-zinc-400">{timeText(message.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-700 dark:text-zinc-300">{message.text}</p>
            </div>
          </div>
        ))}
        {!messages.length && <EmptyBlock text={empty} />}
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
    } catch (error: any) {
      toast.error(error?.message || "Could not update activity");
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
        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{pretty(activity.status)}</span>
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
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${roleColors[item.role] || roleColors.member}`}>{item.role}</span>
      )}
    </div>
  );
}