import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import type {
  ActivityEvidence,
  ActivityParticipant,
  CommunityMember,
  CommunityMessage,
  CommunityPoll,
  CommunityRole,
  IssueCommunity,
  IssueCommunityStatus,
  PollVote,
  VolunteerActivity,
  VolunteerGroup,
  VolunteerGroupMember,
  VolunteerUserSummary,
} from "@/types/volunteering";
import { createNotification } from "@/services/notifications";

export function issueCommunityId(postId: string) {
  return `issue_${postId}`;
}

export function memberId(communityId: string, uid: string) {
  return `${communityId}_${uid}`;
}

export function participantId(activityId: string, uid: string) {
  return `${activityId}_${uid}`;
}

export function groupMemberId(groupId: string, uid: string) {
  return `${groupId}_${uid}`;
}

export async function getUserSummary(uid: string): Promise<VolunteerUserSummary> {
  const snap = await getDoc(doc(db, "users", uid));
  const data = snap.data();

  return {
    uid,
    username: data?.username || "",
    displayName: data?.displayName || data?.username || "Hivez User",
    photoURL: data?.photoURL || "",
  };
}

export async function createIssueCommunityForPost(input: {
  postId: string;
  ownerId: string;
  owner: VolunteerUserSummary;
  caption: string;
  category?: string;
  location?: string | null;
  mediaUrl?: string;
  mediaType?: string;
}) {
  const communityId = issueCommunityId(input.postId);
  const communityRef = doc(db, "issueCommunities", communityId);
  const existing = await getDoc(communityRef);
  if (existing.exists()) return communityId;

  const batch = writeBatch(db);
  const now = serverTimestamp();

  batch.set(communityRef, {
    postId: input.postId,
    issueId: input.postId,
    title: deriveIssueTitle(input.caption, input.category),
    description: input.caption || "Community issue",
    category: input.category || "community",
    location: input.location || null,
    mediaUrl: input.mediaUrl || "",
    mediaType: input.mediaType || "text",
    ownerId: input.ownerId,
    owner: input.owner,
    status: "REPORTED" satisfies IssueCommunityStatus,
    memberCount: 1,
    activityCount: 0,
    rules: ["Stay respectful", "Keep discussion relevant", "No spam or harassment"],
    archived: false,
    createdAt: now,
    updatedAt: now,
  });

  batch.set(doc(db, "communityMembers", memberId(communityId, input.ownerId)), {
    communityId,
    uid: input.ownerId,
    role: "owner" satisfies CommunityRole,
    user: input.owner,
    joinedAt: now,
  });

  batch.update(doc(db, "posts", input.postId), {
    issueCommunityId: communityId,
  });

  await batch.commit();
  return communityId;
}

function deriveIssueTitle(caption: string, category?: string) {
  const clean = caption.trim().replace(/\s+/g, " ");
  if (clean) return clean.length > 70 ? `${clean.slice(0, 67)}...` : clean;
  return `${category || "Community"} issue`;
}

export function listenCommunityByPost(postId: string, onNext: (community: IssueCommunity | null) => void) {
  return onSnapshot(doc(db, "issueCommunities", issueCommunityId(postId)), (snap) => {
    onNext(snap.exists() ? ({ id: snap.id, ...snap.data() } as IssueCommunity) : null);
  });
}

export function listenIssueCommunity(communityId: string, onNext: (community: IssueCommunity | null) => void) {
  return onSnapshot(doc(db, "issueCommunities", communityId), (snap) => {
    onNext(snap.exists() ? ({ id: snap.id, ...snap.data() } as IssueCommunity) : null);
  });
}

export function listenCommunityMember(communityId: string, uid: string, onNext: (member: CommunityMember | null) => void) {
  return onSnapshot(doc(db, "communityMembers", memberId(communityId, uid)), (snap) => {
    onNext(snap.exists() ? ({ id: snap.id, ...snap.data() } as CommunityMember) : null);
  });
}

export function listenCommunityMembers(communityId: string, onNext: (members: CommunityMember[]) => void) {
  const q = query(collection(db, "communityMembers"), where("communityId", "==", communityId));
  return onSnapshot(q, (snapshot) => {
    onNext(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CommunityMember)));
  });
}

export async function joinIssueCommunity(community: IssueCommunity, user: VolunteerUserSummary) {
  const id = memberId(community.id, user.uid);
  const ref = doc(db, "communityMembers", id);
  const existing = await getDoc(ref);
  if (existing.exists()) return;

  const batch = writeBatch(db);
  batch.set(ref, {
    communityId: community.id,
    uid: user.uid,
    role: "member" satisfies CommunityRole,
    user,
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, "issueCommunities", community.id), {
    memberCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  await createNotification({
    recipientId: community.ownerId,
    actor: user,
    type: "broadcast",
    text: `${user.displayName} joined ${community.title}`,
    link: `/issue-community/${community.id}`,
  });
}

export async function leaveIssueCommunity(community: IssueCommunity, member: CommunityMember) {
  if (member.role === "owner") {
    throw new Error("Owners must transfer ownership or archive the community before leaving.");
  }

  const batch = writeBatch(db);
  batch.delete(doc(db, "communityMembers", member.id));
  batch.update(doc(db, "issueCommunities", community.id), {
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export function listenCommunityMessages(
  communityId: string,
  kind: CommunityMessage["kind"],
  onNext: (messages: CommunityMessage[]) => void
) {
  const q = query(
    collection(db, "communityMessages"),
    where("communityId", "==", communityId),
    where("kind", "==", kind)
  );
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CommunityMessage));
    data.sort((a, b) => (a.createdAt?.toDate?.().getTime?.() || 0) - (b.createdAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}

export async function sendCommunityMessage(input: {
  communityId: string;
  user: VolunteerUserSummary;
  text: string;
  kind: CommunityMessage["kind"];
}) {
  await addDoc(collection(db, "communityMessages"), {
    communityId: input.communityId,
    uid: input.user.uid,
    user: input.user,
    text: input.text.trim(),
    kind: input.kind,
    createdAt: serverTimestamp(),
  });
}

export async function deleteCommunityMessage(messageId: string) {
  await updateDoc(doc(db, "communityMessages", messageId), { deleted: true, text: "Message removed" });
}

export function listenCommunityPolls(communityId: string, uid: string | undefined, onNext: (polls: Array<CommunityPoll & { myVote?: PollVote }>) => void) {
  const pollsQ = query(collection(db, "communityPolls"), where("communityId", "==", communityId));
  return onSnapshot(pollsQ, async (snapshot) => {
    const polls = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() } as CommunityPoll))
      .filter((poll) => !poll.deleted);
    polls.sort((a, b) => (b.createdAt?.toDate?.().getTime?.() || 0) - (a.createdAt?.toDate?.().getTime?.() || 0));

    if (!uid || polls.length === 0) {
      onNext(polls);
      return;
    }

    const votes = await Promise.all(
      polls.map(async (poll) => {
        const vote = await getDoc(doc(db, "pollVotes", `${poll.id}_${uid}`));
        return vote.exists() ? ({ id: vote.id, ...vote.data() } as PollVote) : null;
      })
    );

    onNext(polls.map((poll, index) => ({ ...poll, myVote: votes[index] || undefined })));
  });
}

export async function createPoll(input: {
  communityId: string;
  question: string;
  options: string[];
  createdBy: string;
  expiresAt?: string | null;
}) {
  await addDoc(collection(db, "communityPolls"), {
    communityId: input.communityId,
    question: input.question.trim(),
    options: input.options.map((item) => item.trim()).filter(Boolean),
    counts: input.options.map(() => 0),
    totalVotes: 0,
    status: "OPEN",
    createdBy: input.createdBy,
    expiresAt: input.expiresAt || null,
    createdAt: serverTimestamp(),
  });
}

export async function votePoll(poll: CommunityPoll, uid: string, optionIndex: number) {
  if (poll.status !== "OPEN") return;
  const voteRef = doc(db, "pollVotes", `${poll.id}_${uid}`);
  const existing = await getDoc(voteRef);
  if (existing.exists()) return;

  const nextCounts = [...poll.counts];
  nextCounts[optionIndex] = (nextCounts[optionIndex] || 0) + 1;
  const batch = writeBatch(db);
  batch.set(voteRef, {
    pollId: poll.id,
    communityId: poll.communityId,
    uid,
    optionIndex,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "communityPolls", poll.id), {
    counts: nextCounts,
    totalVotes: increment(1),
  });
  await batch.commit();
}

export async function closePoll(pollId: string) {
  await updateDoc(doc(db, "communityPolls", pollId), { status: "CLOSED" });
}

export async function reopenPoll(pollId: string) {
  await updateDoc(doc(db, "communityPolls", pollId), { status: "OPEN" });
}

export async function deletePoll(pollId: string) {
  await updateDoc(doc(db, "communityPolls", pollId), { status: "CLOSED", deleted: true });
}

export function listenVolunteerActivities(communityId: string, onNext: (activities: VolunteerActivity[]) => void) {
  const q = query(collection(db, "volunteerActivities"), where("communityId", "==", communityId));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VolunteerActivity));
    data.sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`));
    onNext(data);
  });
}

export function listenAllVolunteerActivities(onNext: (activities: VolunteerActivity[]) => void) {
  return onSnapshot(collection(db, "volunteerActivities"), (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VolunteerActivity));
    data.sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`));
    onNext(data);
  });
}

export function listenMyActivityParticipants(uid: string, onNext: (participants: ActivityParticipant[]) => void) {
  const q = query(collection(db, "activityParticipants"), where("uid", "==", uid));
  return onSnapshot(q, (snapshot) => {
    onNext(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ActivityParticipant)));
  });
}

export function listenOpenIssueCommunities(onNext: (communities: IssueCommunity[]) => void) {
  return onSnapshot(collection(db, "issueCommunities"), (snapshot) => {
    const data = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() } as IssueCommunity))
      .filter((community) => !community.archived);
    data.sort((a, b) => (b.updatedAt?.toDate?.().getTime?.() || 0) - (a.updatedAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}

export async function createVolunteerActivity(input: Omit<VolunteerActivity, "id" | "createdAt" | "updatedAt" | "volunteerCount">) {
  const activityRef = await addDoc(collection(db, "volunteerActivities"), {
    ...input,
    volunteerCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "issueCommunities", input.communityId), {
    activityCount: increment(1),
    status: "ACTION_STARTED",
    updatedAt: serverTimestamp(),
  });
  return activityRef.id;
}

export function listenActivityParticipant(activityId: string, uid: string, onNext: (participant: ActivityParticipant | null) => void) {
  return onSnapshot(doc(db, "activityParticipants", participantId(activityId, uid)), (snap) => {
    onNext(snap.exists() ? ({ id: snap.id, ...snap.data() } as ActivityParticipant) : null);
  });
}

export async function joinActivity(activity: VolunteerActivity, user: VolunteerUserSummary, role: string) {
  if (activity.status === "CANCELLED" || activity.status === "COMPLETED" || activity.status === "VERIFIED") {
    throw new Error("This activity is closed.");
  }
  if (activity.volunteerLimit > 0 && activity.volunteerCount >= activity.volunteerLimit) {
    throw new Error("This activity is full.");
  }

  const id = participantId(activity.id, user.uid);
  const existing = await getDoc(doc(db, "activityParticipants", id));
  if (existing.exists()) return;

  const batch = writeBatch(db);
  batch.set(doc(db, "activityParticipants", id), {
    activityId: activity.id,
    communityId: activity.communityId,
    uid: user.uid,
    role: role || activity.roles[0] || "Volunteer",
    user,
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, "volunteerActivities", activity.id), {
    volunteerCount: increment(1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function leaveActivity(activity: VolunteerActivity, uid: string) {
  const id = participantId(activity.id, uid);
  const existing = await getDoc(doc(db, "activityParticipants", id));
  if (!existing.exists()) return;

  const batch = writeBatch(db);
  batch.delete(doc(db, "activityParticipants", id));
  batch.update(doc(db, "volunteerActivities", activity.id), {
    volunteerCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function updateActivityStatus(activityId: string, status: VolunteerActivity["status"]) {
  await updateDoc(doc(db, "volunteerActivities", activityId), { status, updatedAt: serverTimestamp() });
}

export async function updateActivityDetails(
  activityId: string,
  input: Pick<VolunteerActivity, "title" | "description" | "location" | "meetingPoint" | "startDate" | "startTime" | "volunteerLimit" | "roles">
) {
  await updateDoc(doc(db, "volunteerActivities", activityId), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function cancelActivity(activityId: string) {
  await updateActivityStatus(activityId, "CANCELLED");
}

export async function submitActivityEvidence(input: Omit<ActivityEvidence, "id" | "status" | "createdAt">) {
  await addDoc(collection(db, "activityEvidence"), {
    ...input,
    status: "SUBMITTED",
    createdAt: serverTimestamp(),
  });
}

export function listenActivityEvidence(communityId: string, onNext: (evidence: ActivityEvidence[]) => void) {
  const q = query(collection(db, "activityEvidence"), where("communityId", "==", communityId));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ActivityEvidence));
    data.sort((a, b) => (b.createdAt?.toDate?.().getTime?.() || 0) - (a.createdAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}

export async function createVolunteerGroup(input: {
  name: string;
  description: string;
  location: string;
  owner: VolunteerUserSummary;
}) {
  const groupRef = await addDoc(collection(db, "volunteerGroups"), {
    name: input.name.trim(),
    description: input.description.trim(),
    location: input.location.trim(),
    ownerId: input.owner.uid,
    owner: input.owner,
    memberCount: 1,
    organizers: [input.owner.uid],
    issueIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await setDoc(doc(db, "volunteerGroupMembers", groupMemberId(groupRef.id, input.owner.uid)), {
    groupId: groupRef.id,
    uid: input.owner.uid,
    role: "owner",
    user: input.owner,
    joinedAt: serverTimestamp(),
  });
}

export function listenVolunteerGroups(onNext: (groups: VolunteerGroup[]) => void) {
  return onSnapshot(collection(db, "volunteerGroups"), (snapshot) => {
    const groups = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VolunteerGroup));
    groups.sort((a, b) => (b.createdAt?.toDate?.().getTime?.() || 0) - (a.createdAt?.toDate?.().getTime?.() || 0));
    onNext(groups);
  });
}

export function listenMyGroupMemberships(uid: string, onNext: (memberships: VolunteerGroupMember[]) => void) {
  const q = query(collection(db, "volunteerGroupMembers"), where("uid", "==", uid));
  return onSnapshot(q, (snapshot) => {
    onNext(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VolunteerGroupMember)));
  });
}

export async function joinVolunteerGroup(group: VolunteerGroup, user: VolunteerUserSummary) {
  const id = groupMemberId(group.id, user.uid);
  const existing = await getDoc(doc(db, "volunteerGroupMembers", id));
  if (existing.exists()) return;
  const batch = writeBatch(db);
  batch.set(doc(db, "volunteerGroupMembers", id), {
    groupId: group.id,
    uid: user.uid,
    role: "member",
    user,
    joinedAt: serverTimestamp(),
  });
  batch.update(doc(db, "volunteerGroups", group.id), { memberCount: increment(1), updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function updateCommunityStatus(communityId: string, status: IssueCommunityStatus) {
  await updateDoc(doc(db, "issueCommunities", communityId), {
    status,
    archived: status === "ARCHIVED",
    updatedAt: serverTimestamp(),
  });
}

export async function updateCommunityMemberRole(member: CommunityMember, role: CommunityRole) {
  if (member.role === "owner") throw new Error("Owner role cannot be changed here.");
  await updateDoc(doc(db, "communityMembers", member.id), { role });
}

export async function removeCommunityMember(community: IssueCommunity, member: CommunityMember) {
  if (member.role === "owner") throw new Error("Owner cannot be removed.");
  const batch = writeBatch(db);
  batch.delete(doc(db, "communityMembers", member.id));
  batch.update(doc(db, "issueCommunities", community.id), {
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function reviewActivityEvidence(evidenceId: string, status: ActivityEvidence["status"]) {
  await updateDoc(doc(db, "activityEvidence", evidenceId), { status });
}

export async function listMyActivityParticipants(uid: string) {
  const snap = await getDocs(query(collection(db, "activityParticipants"), where("uid", "==", uid)));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() } as ActivityParticipant));
}
