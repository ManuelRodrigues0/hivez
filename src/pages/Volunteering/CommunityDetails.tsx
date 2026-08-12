import { useMemo, useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users, Shield, Crown, UserCheck, HandHeart } from "lucide-react";
import { toast } from "sonner";
import HivezLoader from "@/components/common/HivezLoader";
import { useAuth } from "@/context/AuthContext";
import { getUserSummary, joinIssueCommunity, leaveIssueCommunity, listenCommunityMember, listenCommunityMembers, listenIssueCommunity } from "@/services/volunteering";
import type { CommunityMember, IssueCommunity, VolunteerUserSummary } from "@/types/volunteering";

const roleIcons: Record<string, typeof Crown> = {
  owner: Crown,
  organizer: Shield,
  moderator: UserCheck,
  member: Users,
};

const roleColors: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  organizer: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  moderator: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  member: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
};

export default function CommunityDetails() {
  const { communityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [community, setCommunity] = useState<IssueCommunity | null>(null);
  const [member, setMember] = useState<CommunityMember | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [summary, setSummary] = useState<VolunteerUserSummary | null>(null);
  const [busy, setBusy] = useState(false);

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
              <video src={community.mediaUrl} className="h-full w-full object-cover" controls playsInline />
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
                  <div className={`rounded-full p-1.5 ${roleColors[role] || roleColors.member}`}>
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
          {members.map((member: CommunityMember) => {
            const Icon = roleIcons[member.role] || Users;
            return (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
              >
                <img
                  src={member.user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.user.displayName)}&background=111&color=fff`}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-zinc-950 dark:text-white">
                    {member.user.displayName}
                  </p>
                  <p className="truncate text-xs text-zinc-500">
                    @{member.user.username || "hivez"}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${roleColors[member.role] || roleColors.member}`}>
                  <Icon size={12} />
                  {member.role}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
