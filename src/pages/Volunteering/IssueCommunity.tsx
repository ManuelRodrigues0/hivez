import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, CheckCircle2, MapPin, Send, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import HivezLoader from "@/components/common/HivezLoader";
import { useAuth } from "@/context/AuthContext";
import {
  closePoll,
  deletePoll,
  createPoll,
  createVolunteerActivity,
  getUserSummary,
  joinActivity,
  leaveActivity,
  removeCommunityMember,
  reopenPoll,
  reviewActivityEvidence,
  listenActivityEvidence,
  listenActivityParticipant,
  listenCommunityMember,
  listenCommunityMembers,
  listenCommunityMessages,
  listenCommunityPolls,
  listenIssueCommunity,
  listenVolunteerActivities,
  sendCommunityMessage,
  submitActivityEvidence,
  updateActivityDetails,
  updateActivityStatus,
  updateCommunityMemberRole,
  updateCommunityStatus,
  votePoll,
} from "@/services/volunteering";
import type {
  ActivityEvidence,
  ActivityParticipant,
  CommunityMember,
  CommunityMessage,
  CommunityPoll,
  IssueCommunity,
  IssueCommunityStatus,
  VolunteerActivity,
  VolunteerActivityStatus,
  VolunteerUserSummary,
} from "@/types/volunteering";

const tabs = ["Discussion", "Chat", "Polls", "Actions", "Progress", "Members", "Evidence"] as const;
type Tab = (typeof tabs)[number];

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

function pretty(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

function timeText(value: any) {
  if (!value?.toDate) return "";
  return value.toDate().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function IssueCommunityPage() {
  const { communityId } = useParams();
  const { user } = useAuth();
  const [summary, setSummary] = useState<VolunteerUserSummary | null>(null);
  const [community, setCommunity] = useState<IssueCommunity | null>(null);
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [discussion, setDiscussion] = useState<CommunityMessage[]>([]);
  const [chat, setChat] = useState<CommunityMessage[]>([]);
  const [polls, setPolls] = useState<Array<CommunityPoll & { myVote?: any }>>([]);
  const [activities, setActivities] = useState<VolunteerActivity[]>([]);
  const [evidence, setEvidence] = useState<ActivityEvidence[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("Discussion");
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
  const [evidenceActivityId, setEvidenceActivityId] = useState("");
  const [evidenceDescription, setEvidenceDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");

  useEffect(() => {
    if (!user) return;
    getUserSummary(user.uid).then(setSummary);
  }, [user]);

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

  useEffect(() => {
    if (!evidenceActivityId && activities[0]) setEvidenceActivityId(activities[0].id);
  }, [activities, evidenceActivityId]);

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

  async function handleCreateActivity(event: FormEvent) {
    event.preventDefault();
    if (!community || !summary || !canManage || !activityTitle.trim()) return;
    await createVolunteerActivity({
      communityId: community.id,
      issueId: community.issueId,
      title: activityTitle,
      description: activityDescription,
      category: community.category,
      organizerId: summary.uid,
      organizer: summary,
      location: activityLocation || community.location || "",
      meetingPoint: activityLocation || community.location || "",
      startDate: activityDate,
      startTime: activityTime,
      endDate: activityDate,
      endTime: "",
      volunteerLimit: Number(activityLimit) || 0,
      status: "OPEN",
      urgent: false,
      roles: activityRoles.split(",").map((item) => item.trim()).filter(Boolean),
      requirements: "Bring what you need for the activity.",
      instructions: "Coordinate in the community chat before arriving.",
      verificationMethod: "Organizer review",
      evidenceRequirements: "Upload a photo, video, or short note after the work is done.",
    });
    setActivityTitle("");
    setActivityDescription("");
    setActivityDate("");
    setActivityTime("");
    setActivityLocation("");
    toast.success("Volunteer action created");
  }

  async function handleSubmitEvidence(event: FormEvent) {
    event.preventDefault();
    if (!community || !summary || !evidenceActivityId || !evidenceDescription.trim()) return;
    await submitActivityEvidence({
      activityId: evidenceActivityId,
      communityId: community.id,
      uid: summary.uid,
      user: summary,
      description: evidenceDescription,
      mediaUrl: evidenceUrl,
      mediaType: evidenceUrl ? "image" : "text",
    });
    setEvidenceDescription("");
    setEvidenceUrl("");
    toast.success("Evidence submitted");
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
            <span className="rounded-full bg-zinc-950 px-2.5 py-0.5 text-[11px] font-bold uppercase text-white dark:bg-white dark:text-black sm:px-3 sm:py-1 sm:text-xs">{pretty(community.status)}</span>
            {community.location && <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 sm:px-3 sm:py-1 sm:text-xs"><MapPin size={12} />{community.location}</span>}
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 sm:px-3 sm:py-1 sm:text-xs"><Users size={12} />{community.memberCount} members</span>
          </div>
          <div className="flex items-start gap-2.5 sm:gap-3">
            {community.mediaUrl && (
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900 sm:h-10 sm:w-10">
                {community.mediaType === "video" ? (
                  <video src={community.mediaUrl} className="h-full w-full object-cover" playsInline />
                ) : (
                  <img src={community.mediaUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            )}
            <Link to={`/issue-community/${community.id}/details`} className="group block flex-1">
              <h1 className="text-lg font-black tracking-tight text-zinc-950 transition group-hover:underline dark:text-white sm:text-xl sm:font-black md:text-2xl">{community.title}</h1>
            </Link>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-zinc-700 dark:text-zinc-300 sm:mt-2 sm:text-sm sm:leading-6">{community.description}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 sm:mt-1 sm:text-xs">@{community.owner.username}</p>
        </div>
      </header>

      <nav className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-xl dark:border-zinc-800 dark:bg-black/95">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`h-10 shrink-0 rounded-full px-4 text-sm font-bold transition ${activeTab === tab ? "bg-zinc-950 text-white dark:bg-white dark:text-black" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
            {tab}
          </button>
        ))}
      </nav>

      <main className="px-4 py-5">
        {(activeTab === "Discussion" || activeTab === "Chat") && (
          <MessagePanel messages={activeTab === "Chat" ? chat : discussion} canPost={isMember} value={messageText} onChange={setMessageText} onSubmit={handleSendMessage} mode={activeTab} />
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
                <p className="mt-3 text-xs font-semibold text-zinc-500">{poll.totalVotes} votes • {pretty(poll.status)}</p>
              </div>
            ))}
            {!polls.length && <EmptyBlock text="No polls yet. Owners and organizers can create one above." />}
          </section>
        )}

        {activeTab === "Actions" && (
          <section className="space-y-4">
            {canManage && (
              <form onSubmit={handleCreateActivity} className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <input value={activityTitle} onChange={(e) => setActivityTitle(e.target.value)} placeholder="Action title" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                <textarea value={activityDescription} onChange={(e) => setActivityDescription(e.target.value)} placeholder="What needs to happen?" className="min-h-24 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                  <input type="time" value={activityTime} onChange={(e) => setActivityTime(e.target.value)} className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                  <input value={activityLocation} onChange={(e) => setActivityLocation(e.target.value)} placeholder="Meeting point" className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                  <input value={activityLimit} onChange={(e) => setActivityLimit(e.target.value)} placeholder="Volunteer limit" className="h-12 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                </div>
                <input value={activityRoles} onChange={(e) => setActivityRoles(e.target.value)} placeholder="Roles" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                <button className="h-10 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white dark:bg-white dark:text-black">Create action</button>
              </form>
            )}
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} summary={summary} canManage={canManage} isOwner={isOwner} isCommunityMember={isMember} />
            ))}
            {!activities.length && <EmptyBlock text="No volunteer actions yet." />}
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
                {issueStatuses.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}
              </select>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric icon={<Users size={18} />} label="Members" value={community.memberCount} />
              <Metric icon={<CalendarDays size={18} />} label="Actions" value={community.activityCount} />
              <Metric icon={<CheckCircle2 size={18} />} label="Evidence" value={evidence.length} />
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
                <select value={evidenceActivityId} onChange={(e) => setEvidenceActivityId(e.target.value)} className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white">
                  {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
                </select>
                <textarea value={evidenceDescription} onChange={(e) => setEvidenceDescription(e.target.value)} placeholder="Describe what was completed or verified" className="min-h-24 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                <input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="Optional image/video URL" className="h-12 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-white" />
                <button className="h-10 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white dark:bg-white dark:text-black">Submit evidence</button>
              </form>
            )}
            {evidence.map((item) => (
              <div key={item.id} className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center gap-3">
                  <img src={item.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.user.displayName)}&background=111&color=fff`} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-black text-zinc-950 dark:text-white">{item.user.displayName}</p>
                    <p className="text-xs font-semibold text-zinc-500">{pretty(item.status)} • {timeText(item.createdAt)}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{item.description}</p>
                {item.mediaUrl && <img src={item.mediaUrl} alt="" className="mt-3 max-h-80 w-full rounded-2xl object-cover" />}
                {canManage && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["REVIEWED", "ACCEPTED", "REJECTED"] as ActivityEvidence["status"][]).map((status) => (
                      <button key={status} onClick={() => reviewActivityEvidence(item.id, status).then(() => toast.success("Evidence updated"))} className="h-9 rounded-full border border-zinc-200 px-3 text-xs font-bold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900">
                        {pretty(status)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {!evidence.length && <EmptyBlock text="No evidence submitted yet." />}
          </section>
        )}
      </main>
    </div>
  );
}

function MessagePanel({ messages, canPost, value, onChange, onSubmit, mode }: { messages: CommunityMessage[]; canPost: boolean; value: string; onChange: (value: string) => void; onSubmit: (event: FormEvent) => void; mode: string }) {
  return (
    <section className="space-y-4">
      <div className="space-y-3">
        {messages.map((message) => (
          <div key={message.id} className="flex gap-3 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <img src={message.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(message.user.displayName)}&background=111&color=fff`} alt="" className="h-10 w-10 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="text-sm font-black text-zinc-950 dark:text-white">{message.user.displayName} <span className="font-semibold text-zinc-400">{timeText(message.createdAt)}</span></p>
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

function ActivityCard({ activity, summary, canManage, isOwner, isCommunityMember }: { activity: VolunteerActivity; summary: VolunteerUserSummary | null; canManage: boolean; isOwner: boolean; isCommunityMember: boolean }) {
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
    } catch (error: any) {
      toast.error(error?.message || "Could not update activity");
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
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{activity.description}</p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-bold uppercase text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{pretty(activity.status)}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-zinc-500">
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><CalendarDays size={14} />{activity.startDate || "Flexible"}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><MapPin size={14} />{activity.location || "Nearby"}</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900"><Users size={14} />{activity.volunteerCount}{activity.volunteerLimit ? `/${activity.volunteerLimit}` : ""}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={!isCommunityMember || busy} onClick={toggleJoin} className="h-10 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white disabled:opacity-50 dark:bg-white dark:text-black">
          {joined ? "Leave action" : "Join action"}
        </button>
        {canManage && (
          <select value={activity.status} onChange={(e) => updateActivityStatus(activity.id, e.target.value as VolunteerActivityStatus)} className="h-10 rounded-full border border-zinc-200 bg-white px-4 text-sm font-bold dark:border-zinc-800 dark:bg-zinc-950 dark:text-white">
            {activityStatuses.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}
          </select>
        )}
        {canManage && <button onClick={() => setEditing(true)} className="h-10 rounded-full border border-zinc-200 px-4 text-sm font-bold dark:border-zinc-800">Edit</button>}
        {isOwner && activity.status !== "CANCELLED" && <button onClick={() => updateActivityStatus(activity.id, "CANCELLED").then(() => toast.success("Action cancelled"))} className="h-10 rounded-full border border-red-200 px-4 text-sm font-bold text-red-500 dark:border-red-950">Cancel action</button>}
      </div>
        </>
      )}
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

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-3xl bg-zinc-50 p-4 dark:bg-zinc-900">
      <div className="text-zinc-500">{icon}</div>
      <p className="mt-3 text-2xl font-black text-zinc-950 dark:text-white">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">{label}</p>
    </div>
  );
}
