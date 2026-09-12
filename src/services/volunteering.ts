import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/firebase/firebase";
import type {
  ActivityContactUpdate,
  ActivityEvidence,
  ActivityMessage,
  ActivityParticipant,
  ActionProgressState,
  CommunityConfirmation,
  CommunityMember,
  CommunityMessage,
  CommunityPoll,
  CommunityRole,
  EvidenceTypeKey,
  IssueCommunity,
  IssueCommunityStatus,
  ParticipantStatus,
  PollVote,
  ReviewerDecision,
  VerificationCase,
  VerificationCaseEvent,
  VerificationCaseStatus,
  VerificationDecision,
  VerificationHistoryEntry,
  VolunteerActivity,
  VolunteerGroup,
  VolunteerGroupMember,
  VolunteerGroupMessage,
  VolunteerUserSummary,
  WitnessConfirmation,
} from "@/types/volunteering";
import { OWNER_RESPONSE_DEADLINE_DAYS } from "@/types/volunteering";
import { createNotification } from "@/services/notifications";
import {
  getVerificationRequirements,
  isCaseReviewable,
  ownerResponseDeadlineMs,
  resolveEligibleReviewers,
  verificationCaseId,
} from "@/utils/verification";
import type { LocationSnapshot } from "@/services/location";

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
  locationSnapshot?: LocationSnapshot | null;
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
    locationSnapshot: input.locationSnapshot || null,
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
  const communityRef = doc(db, "issueCommunities", community.id);

  // Transaction keeps memberCount consistent even if several users join at
  // exactly the same time (the member doc id is deterministic, so duplicate
  // membership is impossible - only the counter needs protecting).
  const joined = await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) return false;

    tx.set(ref, {
      communityId: community.id,
      uid: user.uid,
      role: "member" satisfies CommunityRole,
      user,
      joinedAt: serverTimestamp(),
    });
    tx.update(communityRef, {
      memberCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    return true;
  });

  if (!joined) return;

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

  await runTransaction(db, async (tx) => {
    const ref = doc(db, "communityMembers", member.id);
    const existing = await tx.get(ref);
    if (!existing.exists()) return;

    tx.delete(ref);
    tx.update(doc(db, "issueCommunities", community.id), {
      memberCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  });
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
  const pollRef = doc(db, "communityPolls", poll.id);

  // Transaction prevents concurrent first-time voters from double counting and
  // stops the counts array from being recomputed from stale client data.
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(voteRef);
    if (existing.exists()) return;

    const pollSnap = await tx.get(pollRef);
    if (!pollSnap.exists() || pollSnap.data().status !== "OPEN") return;

    const counts = [...(pollSnap.data().counts || [])];
    counts[optionIndex] = (counts[optionIndex] || 0) + 1;

    tx.set(voteRef, {
      pollId: poll.id,
      communityId: poll.communityId,
      uid,
      optionIndex,
      createdAt: serverTimestamp(),
    });
    tx.update(pollRef, {
      counts,
      totalVotes: increment(1),
    });
  });
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

export function listenAllVolunteerActivities(
  onNext: (activities: VolunteerActivity[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    collection(db, "volunteerActivities"),
    (snapshot) => {
      const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VolunteerActivity));
      data.sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`));
      onNext(data);
    },
    onError
  );
}

export function listenMyActivityParticipants(uid: string, onNext: (participants: ActivityParticipant[]) => void) {
  const q = query(collection(db, "activityParticipants"), where("uid", "==", uid));
  return onSnapshot(q, (snapshot) => {
    onNext(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ActivityParticipant)));
  });
}

export function listenOpenIssueCommunities(
  onNext: (communities: IssueCommunity[]) => void,
  onError?: (error: Error) => void
) {
  return onSnapshot(
    collection(db, "issueCommunities"),
    (snapshot) => {
      const data = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as IssueCommunity))
        .filter((community) => !community.archived);
      data.sort((a, b) => (b.updatedAt?.toDate?.().getTime?.() || 0) - (a.updatedAt?.toDate?.().getTime?.() || 0));
      onNext(data);
    },
    onError
  );
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
  const id = participantId(activity.id, user.uid);
  const participantRef = doc(db, "activityParticipants", id);
  const activityRef = doc(db, "volunteerActivities", activity.id);

  // Atomic join: re-checks status and capacity against the live document, so
  // two volunteers racing for the last slot can never exceed the limit.
  const joined = await runTransaction(db, async (tx) => {
    const existing = await tx.get(participantRef);
    if (existing.exists()) return false;

    const activitySnap = await tx.get(activityRef);
    if (!activitySnap.exists()) {
      throw new Error("This activity no longer exists.");
    }

    const data = activitySnap.data();
    const status = data.status;
    if (["CANCELLED", "COMPLETED", "VERIFIED"].includes(status)) {
      throw new Error("This activity is closed.");
    }

    const count = Number(data.volunteerCount || 0);
    const limit = Number(data.volunteerLimit || 0);
    if (limit > 0 && count >= limit) {
      throw new Error("This activity is full.");
    }

    tx.set(participantRef, {
      activityId: activity.id,
      communityId: activity.communityId,
      uid: user.uid,
      role: role || data.roles?.[0] || "Volunteer",
      user,
      joinedAt: serverTimestamp(),
    });
    tx.update(activityRef, {
      volunteerCount: increment(1),
      updatedAt: serverTimestamp(),
    });
    return true;
  });

  if (!joined) return false;

  // Let the organizer know they gained a volunteer.
  if (activity.organizerId !== user.uid) {
    await createNotification({
      recipientId: activity.organizerId,
      actor: user,
      type: "broadcast",
      text: `${user.displayName} joined your action “${activity.title}”.`,
      link: `/issue-community/${activity.communityId}`,
    });
  }
  return true;
}

export async function leaveActivity(activity: VolunteerActivity, uid: string, actor?: VolunteerUserSummary) {
  const id = participantId(activity.id, uid);

  // Atomic leave: the counter is only decremented when the participant doc
  // actually existed, preventing double decrements from rapid clicks.
  let left = false;
  await runTransaction(db, async (tx) => {
    const participantRef = doc(db, "activityParticipants", id);
    const existing = await tx.get(participantRef);
    if (!existing.exists()) return;

    tx.delete(participantRef);
    tx.update(doc(db, "volunteerActivities", activity.id), {
      volunteerCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
    left = true;
  });

  if (left && actor && activity.organizerId !== actor.uid) {
    await createNotification({
      recipientId: activity.organizerId,
      actor,
      type: "broadcast",
      text: `${actor.displayName} left your action “${activity.title}”.`,
      link: `/issue-community/${activity.communityId}`,
    });
  }
  return left;
}

export async function updateActivityStatus(activityId: string, status: VolunteerActivity["status"]) {
  await updateDoc(doc(db, "volunteerActivities", activityId), { status, updatedAt: serverTimestamp() });
}

export async function updateActivityDetails(
  activityId: string,
  input: Partial<
    Pick<
      VolunteerActivity,
      | "title"
      | "description"
      | "category"
      | "location"
      | "locationSnapshot"
      | "meetingPoint"
      | "startDate"
      | "startTime"
      | "endDate"
      | "endTime"
      | "volunteerLimit"
      | "roles"
      | "requirements"
      | "instructions"
      | "urgent"
      | "verificationMethod"
      | "evidenceRequirements"
      | "groupId"
    >
  >
) {
  await updateDoc(doc(db, "volunteerActivities", activityId), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function cancelActivity(activity: VolunteerActivity, actor?: VolunteerUserSummary) {
  await updateActivityStatus(activity.id, "CANCELLED");

  if (!actor) return;
  const participants = await getDocs(
    query(collection(db, "activityParticipants"), where("activityId", "==", activity.id))
  );
  await Promise.all(
    participants.docs.map(async (snap) => {
      const participant = snap.data() as ActivityParticipant;
      if (participant.uid === actor.uid) return;
      await createNotification({
        recipientId: participant.uid,
        actor,
        type: "broadcast",
        text: `The action “${activity.title}” was cancelled.`,
        link: `/issue-community/${activity.communityId}`,
      });
    })
  );
}

export async function submitActivityEvidence(input: Omit<ActivityEvidence, "id" | "status" | "createdAt">) {
  const evidenceRef = await addDoc(collection(db, "activityEvidence"), {
    ...input,
    status: "SUBMITTED",
    createdAt: serverTimestamp(),
  });

  // Verification history: a submission always enters as PENDING.
  await addDoc(collection(db, "verificationRecords"), {
    communityId: input.communityId,
    activityId: input.activityId,
    submittedBy: input.uid,
    status: "PENDING",
    reviewedBy: null,
    notes: "Evidence submitted - awaiting review.",
    createdAt: serverTimestamp(),
  } satisfies Omit<VerificationHistoryEntry, "id">);

  // Every real evidence submission drives a verification case. The case for a
  // community is created lazily on the first submission and reused after,
  // so all volunteers' proof for one issue resolves through a single audit.
  await ensureVerificationCaseForEvidence({
    communityId: input.communityId,
    activityId: input.activityId,
    evidenceId: evidenceRef.id,
    submitter: input.user,
  });

  return evidenceRef.id;
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
  const ref = doc(db, "volunteerGroupMembers", id);
  const groupRef = doc(db, "volunteerGroups", group.id);

  // Transaction keeps memberCount consistent under concurrent joins.
  const joined = await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) return false;

    tx.set(ref, {
      groupId: group.id,
      uid: user.uid,
      role: "member",
      user,
      joinedAt: serverTimestamp(),
    });
    tx.update(groupRef, { memberCount: increment(1), updatedAt: serverTimestamp() });
    return true;
  });

  if (!joined) return false;

  if (group.ownerId !== user.uid) {
    await createNotification({
      recipientId: group.ownerId,
      actor: user,
      type: "broadcast",
      text: `${user.displayName} joined your group “${group.name}”.`,
      link: `/volunteering/groups/${group.id}`,
    });
  }
  return true;
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

export async function reviewActivityEvidence(
  evidence: ActivityEvidence,
  status: ActivityEvidence["status"],
  reviewer?: VolunteerUserSummary | null
) {
  const batch = writeBatch(db);
  batch.update(doc(db, "activityEvidence", evidence.id), {
    status,
    ...(reviewer ? { reviewedBy: reviewer.uid, reviewedAt: serverTimestamp() } : {}),
  });
  batch.set(doc(collection(db, "verificationRecords")), {
    communityId: evidence.communityId,
    activityId: evidence.activityId,
    submittedBy: evidence.uid,
    status: status === "ACCEPTED" ? "APPROVED" : status === "REJECTED" ? "REJECTED" : "PENDING",
    reviewedBy: reviewer?.uid || null,
    notes: `Evidence ${status.toLowerCase().replace("_", " ")} by reviewer.`,
    createdAt: serverTimestamp(),
    reviewedAt: serverTimestamp(),
  } satisfies Omit<VerificationHistoryEntry, "id">);
  await batch.commit();

  // Tell the submitter when an authorized user reviews their proof.
  if (reviewer && evidence.uid !== reviewer.uid) {
    await createNotification({
      recipientId: evidence.uid,
      actor: reviewer,
      type: "broadcast",
      text: `Your evidence was marked ${status.toLowerCase().replace("_", " ")}.`,
      link: `/issue-community/${evidence.communityId}`,
    });
  }
}

export async function listMyActivityParticipants(uid: string) {
  const snap = await getDocs(query(collection(db, "activityParticipants"), where("uid", "==", uid)));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() } as ActivityParticipant));
}
// =====================================================================
// MY VOLUNTEERING
// =====================================================================

export function listenCommunityMemberships(uid: string, onNext: (memberships: CommunityMember[]) => void) {
  const q = query(collection(db, "communityMembers"), where("uid", "==", uid));
  return onSnapshot(q, (snapshot) => {
    onNext(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CommunityMember)));
  });
}

/** The signed-in user's own evidence submissions, newest first. */
export function listenMyEvidence(uid: string, onNext: (evidence: ActivityEvidence[]) => void) {
  const q = query(collection(db, "activityEvidence"), where("uid", "==", uid));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ActivityEvidence));
    data.sort((a, b) => (b.createdAt?.toDate?.().getTime?.() || 0) - (a.createdAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}

// =====================================================================
// OWNERSHIP TRANSFER
// =====================================================================

/** Safely transfer an issue community to another member. The former owner
 *  becomes an organizer and the new owner takes the owner role. */
export async function transferCommunityOwnership(community: IssueCommunity, newOwner: CommunityMember) {
  if (newOwner.uid === community.ownerId) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "communityMembers", memberId(community.id, community.ownerId)), { role: "organizer" });
  batch.update(doc(db, "communityMembers", memberId(community.id, newOwner.uid)), { role: "owner" });
  batch.update(doc(db, "issueCommunities", community.id), {
    ownerId: newOwner.uid,
    owner: newOwner.user,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

/** Safely transfer a volunteer group to another member. */
export async function transferGroupOwnership(group: VolunteerGroup, newOwner: VolunteerGroupMember) {
  if (newOwner.uid === group.ownerId) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "volunteerGroupMembers", groupMemberId(group.id, group.ownerId)), { role: "organizer" });
  batch.update(doc(db, "volunteerGroupMembers", groupMemberId(group.id, newOwner.uid)), { role: "owner" });
  batch.update(doc(db, "volunteerGroups", group.id), {
    ownerId: newOwner.uid,
    owner: newOwner.user,
    organizers: group.organizers.includes(newOwner.uid)
      ? group.organizers
      : [...group.organizers, newOwner.uid],
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}
// =====================================================================
// VOLUNTEER GROUP WORKSPACE
// =====================================================================

export function listenGroup(groupId: string, onNext: (group: VolunteerGroup | null) => void) {
  return onSnapshot(doc(db, "volunteerGroups", groupId), (snap) => {
    onNext(snap.exists() ? ({ id: snap.id, ...snap.data() } as VolunteerGroup) : null);
  });
}

export function listenGroupMember(groupId: string, uid: string, onNext: (member: VolunteerGroupMember | null) => void) {
  return onSnapshot(doc(db, "volunteerGroupMembers", groupMemberId(groupId, uid)), (snap) => {
    onNext(snap.exists() ? ({ id: snap.id, ...snap.data() } as VolunteerGroupMember) : null);
  });
}

export function listenGroupMembers(groupId: string, onNext: (members: VolunteerGroupMember[]) => void) {
  const q = query(collection(db, "volunteerGroupMembers"), where("groupId", "==", groupId));
  return onSnapshot(q, (snapshot) => {
    onNext(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VolunteerGroupMember)));
  });
}

export async function leaveVolunteerGroup(group: VolunteerGroup, member: VolunteerGroupMember) {
  if (member.role === "owner") {
    throw new Error("Owners must transfer ownership before leaving the group.");
  }
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "volunteerGroupMembers", member.id);
    const existing = await tx.get(ref);
    if (!existing.exists()) return;
    tx.delete(ref);
    tx.update(doc(db, "volunteerGroups", group.id), {
      memberCount: increment(-1),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function updateGroupDetails(
  groupId: string,
  input: Partial<Pick<VolunteerGroup, "name" | "description" | "location">>
) {
  await updateDoc(doc(db, "volunteerGroups", groupId), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function updateGroupMemberRole(group: VolunteerGroup, member: VolunteerGroupMember, role: CommunityRole) {
  if (member.role === "owner") throw new Error("Owner role cannot be changed here.");
  const batch = writeBatch(db);
  batch.update(doc(db, "volunteerGroupMembers", member.id), { role });
  if (role === "organizer" && !group.organizers.includes(member.uid)) {
    batch.update(doc(db, "volunteerGroups", group.id), {
      organizers: arrayUnion(member.uid),
      updatedAt: serverTimestamp(),
    });
  } else if (member.role === "organizer" && role !== "organizer") {
    batch.update(doc(db, "volunteerGroups", group.id), {
      organizers: arrayRemove(member.uid),
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function removeGroupMember(group: VolunteerGroup, member: VolunteerGroupMember) {
  if (member.role === "owner") throw new Error("Owner cannot be removed.");
  const batch = writeBatch(db);
  batch.delete(doc(db, "volunteerGroupMembers", member.id));
  batch.update(doc(db, "volunteerGroups", group.id), {
    memberCount: increment(-1),
    organizers: arrayRemove(member.uid),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export function listenGroupActivities(groupId: string, onNext: (activities: VolunteerActivity[]) => void) {
  const q = query(collection(db, "volunteerActivities"), where("groupId", "==", groupId));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VolunteerActivity));
    data.sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`));
    onNext(data);
  });
}

// =====================================================================
// COMMUNITY VERIFICATION CASES
// =====================================================================

/**
 * Create (or update) the single verification case for a community when real
 * evidence arrives. The case id is deterministic per community, so multiple
 * activities submitting evidence all resolve through one audit trail.
 */
export async function ensureVerificationCaseForEvidence(input: {
  communityId: string;
  activityId?: string;
  evidenceId: string;
  submitter: VolunteerUserSummary;
}): Promise<string> {
  const caseId = verificationCaseId(input.communityId);
  const caseRef = doc(db, "verificationCases", caseId);
  const communityId = input.communityId;

  // Resolve review context from live data so eligible reviewers reflect the
  // current organizer structure, never a client-provided list.
  const [communitySnap, membersSnap, activitySnap] = await Promise.all([
    getDoc(doc(db, "issueCommunities", communityId)),
    getDocs(query(collection(db, "communityMembers"), where("communityId", "==", communityId))),
    input.activityId
      ? getDoc(doc(db, "volunteerActivities", input.activityId))
      : Promise.resolve(null),
  ]);

  const community = communitySnap.exists() ? ({ id: communitySnap.id, ...communitySnap.data() } as IssueCommunity) : null;
  const members = membersSnap.docs.map((item) => ({ id: item.id, ...item.data() } as CommunityMember));
  const activity = activitySnap?.exists()
    ? ({ id: activitySnap.id, ...activitySnap.data() } as VolunteerActivity)
    : null;

  const requirements = getVerificationRequirements(community?.category);
  const eligible = resolveEligibleReviewers({
    community,
    activity,
    members,
  });
  const primaryReviewerId = community?.ownerId && eligible.ids.includes(community.ownerId)
    ? community.ownerId
    : eligible.ids[0] || null;
  const primaryReviewerRole = primaryReviewerId
    ? primaryReviewerId === community?.ownerId
      ? "community_owner"
      : "authorized_reviewer"
    : null;

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(caseRef);

    if (existing.exists()) {
      const current = existing.data() as VerificationCase;
      tx.update(caseRef, {
        evidenceIds: arrayUnion(input.evidenceId),
        status: current.status === "DRAFT"
          ? "SUBMITTED"
          : current.status === "NEEDS_MORE_EVIDENCE"
            ? "UNDER_REVIEW"
            : current.status,
        updatedAt: serverTimestamp(),
      });
      tx.set(doc(collection(db, "verificationCases", caseId, "events")), {
        caseId,
        communityId,
        eventType: "EVIDENCE_SUBMITTED",
        text: `${input.submitter.displayName} submitted new evidence.`,
        userId: input.submitter.uid,
        createdAt: serverTimestamp(),
      } satisfies Omit<VerificationCaseEvent, "id">);
      return;
    }

    tx.set(caseRef, {
      issueId: community?.issueId || "",
      postId: community?.postId || "",
      communityId,
      activityId: activity?.id || null,
      groupId: activity?.groupId || null,
      status: "SUBMITTED",
      verificationTemplate: requirements.template,
      requiredApprovals: requirements.requiredApprovals,
      requiredRejections: requirements.requiredRejections,
      reviewerQuorum: eligible.ids.length,
      primaryReviewerId,
      primaryReviewerRole,
      eligibleReviewerIds: eligible.ids,
      eligibleReviewerRoles: eligible.roles,
      evidenceIds: [input.evidenceId],
      approvalCount: 0,
      rejectionCount: 0,
      moreEvidenceCount: 0,
      ownerResponseDeadline: ownerResponseDeadlineMs(OWNER_RESPONSE_DEADLINE_DAYS),
      fallbackActivated: false,
      disputeNote: null,
      communityConfirmations: 0,
      witnessConfirmations: 0,
      createdAt: serverTimestamp(),
      submittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(collection(db, "verificationCases", caseId, "events")), {
      caseId,
      communityId,
      eventType: "CASE_CREATED",
      text: `Verification case opened for ${community?.title || "this community issue"}.`,
      userId: input.submitter.uid,
      createdAt: serverTimestamp(),
    } satisfies Omit<VerificationCaseEvent, "id">);
  });

  // Let the primary reviewer know real evidence is waiting.
  if (primaryReviewerId && primaryReviewerId !== input.submitter.uid) {
    await createNotification({
      recipientId: primaryReviewerId,
      actor: input.submitter,
      type: "broadcast",
      text: `${input.submitter.displayName} submitted new evidence for verification.`,
      link: `/issue-community/${communityId}?tab=Verification`,
      postId: community?.postId || undefined,
    });
  }

  return caseId;
}

export async function getVerificationCase(caseId: string): Promise<VerificationCase | null> {
  const snap = await getDoc(doc(db, "verificationCases", caseId));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as VerificationCase) : null;
}

export function listenVerificationCase(caseId: string, onNext: (caseData: VerificationCase | null) => void) {
  return onSnapshot(doc(db, "verificationCases", caseId), (snap) => {
    onNext(snap.exists() ? ({ id: snap.id, ...snap.data() } as VerificationCase) : null);
  });
}

export function listenVerificationCases(communityId: string, onNext: (cases: VerificationCase[]) => void) {
  const q = query(collection(db, "verificationCases"), where("communityId", "==", communityId));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VerificationCase));
    data.sort((a, b) => (b.updatedAt?.toDate?.().getTime?.() || 0) - (a.updatedAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}

/**
 * Open cases where the user is the primary reviewer or an eligible secondary
 * reviewer. Two separate queries (primary id vs array-contains) avoid needing
 * a composite index and merge into one result list.
 */
export function listenMyReviewCases(uid: string, onNext: (cases: VerificationCase[]) => void) {
  const openStatuses = ["SUBMITTED", "UNDER_REVIEW", "PARTIALLY_CONFIRMED", "NEEDS_MORE_EVIDENCE", "DISPUTED"];
  const seen = new Map<string, VerificationCase>();

  function emit() {
    const merged = [...seen.values()].sort(
      (a, b) => (b.updatedAt?.toDate?.().getTime?.() || 0) - (a.updatedAt?.toDate?.().getTime?.() || 0)
    );
    onNext(merged);
  }

  const unsubPrimary = onSnapshot(
    query(collection(db, "verificationCases"), where("primaryReviewerId", "==", uid), where("status", "in", openStatuses)),
    (snapshot) => {
      snapshot.docs.forEach((item) => seen.set(item.id, { id: item.id, ...item.data() } as VerificationCase));
      emit();
    }
  );

  const unsubEligible = onSnapshot(
    query(collection(db, "verificationCases"), where("eligibleReviewerIds", "array-contains", uid), where("status", "in", openStatuses)),
    (snapshot) => {
      snapshot.docs.forEach((item) => seen.set(item.id, { id: item.id, ...item.data() } as VerificationCase));
      emit();
    }
  );

  return () => {
    unsubPrimary();
    unsubEligible();
  };
}

export function listenVerificationDecisions(caseId: string, onNext: (decisions: VerificationDecision[]) => void) {
  return onSnapshot(collection(db, "verificationCases", caseId, "decisions"), (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VerificationDecision));
    data.sort((a, b) => (b.createdAt?.toDate?.().getTime?.() || 0) - (a.createdAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}

export function listenVerificationEvents(caseId: string, onNext: (events: VerificationCaseEvent[]) => void) {
  return onSnapshot(collection(db, "verificationCases", caseId, "events"), (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VerificationCaseEvent));
    data.sort((a, b) => (a.createdAt?.toDate?.().getTime?.() || 0) - (b.createdAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}

export function listenWitnessConfirmations(caseId: string, onNext: (confirmations: WitnessConfirmation[]) => void) {
  return onSnapshot(collection(db, "witnessConfirmations"), (snapshot) => {
    const data = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() } as WitnessConfirmation))
      .filter((item) => item.caseId === caseId);
    data.sort((a, b) => (a.createdAt?.toDate?.().getTime?.() || 0) - (b.createdAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}

export async function submitReviewerDecision(input: {
  caseData: VerificationCase;
  reviewer: VolunteerUserSummary;
  decision: ReviewerDecision;
  reason?: string | null;
  comments?: string | null;
}): Promise<VerificationCaseStatus> {
  const { caseData, reviewer, decision } = input;

  if (decision !== "APPROVE" && !input.reason) {
    throw new Error("Please provide a reason for a negative decision.");
  }

  const reviewerRole = caseData.primaryReviewerId === reviewer.uid
    ? "primary"
    : "authorized_secondary";

  const caseRef = doc(db, "verificationCases", caseData.id);
  const decisionRef = doc(db, "verificationCases", caseData.id, "decisions", `${caseData.id}_${reviewer.uid}`);
  const now = serverTimestamp();

  let completedStatus: VerificationCaseStatus = caseData.status;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(caseRef);
    if (!snap.exists()) throw new Error("Verification case no longer exists.");
    const current = snap.data() as VerificationCase;

    if (!isCaseReviewable(current.status)) {
      throw new Error("This verification case is already closed.");
    }
    if (current.primaryReviewerId !== reviewer.uid && !current.eligibleReviewerIds.includes(reviewer.uid)) {
      throw new Error("You are not authorized to review this verification case.");
    }

    const existingDecision = await tx.get(decisionRef);
    if (existingDecision.exists()) {
      throw new Error("You have already submitted a decision for this case.");
    }

    // ---- Owner inactivity fallback ----
    // If the primary reviewer/owner has NOT started and their window expired,
    // the case is settled by the eligible reviewer quorum instead of requiring
    // the owner's approval. Only activated when there is a real deadline and
    // the owner genuinely has not participated.
    let fallbackActivated = current.fallbackActivated || false;
    let requiredApprovals = current.requiredApprovals;
    const ownerStarted = current.primaryReviewerId
      ? (await tx.get(doc(db, "verificationCases", caseData.id, "decisions", `${caseData.id}_${current.primaryReviewerId}`))).exists()
      : true;
    if (
      !fallbackActivated &&
      current.primaryReviewerId &&
      !ownerStarted &&
      current.ownerResponseDeadline &&
      Date.now() > current.ownerResponseDeadline
    ) {
      fallbackActivated = true;
      requiredApprovals = Math.min(2, Math.max(2, requiredApprovals));
    }

    // Counts are recomputed inside the transaction so the resulting status can
    // never be based on stale client state (transactions retry on conflict).
    const approvals = current.approvalCount + (decision === "APPROVE" ? 1 : 0);
    const rejections = current.rejectionCount + (decision === "REJECT" ? 1 : 0);
    const moreEvidence = current.moreEvidenceCount + (decision === "MORE_EVIDENCE" ? 1 : 0);

    // ---- Threshold resolution ----
    // A dispute is recorded when both approval and rejection paths are met, or
    // when rejections block verification after a prior approval.
    if (approvals >= requiredApprovals && rejections >= current.requiredRejections) {
      completedStatus = "DISPUTED";
    } else if (approvals >= requiredApprovals) {
      completedStatus = "VERIFIED";
    } else if (rejections >= current.requiredRejections && approvals > 0) {
      completedStatus = "DISPUTED";
    } else if (rejections >= current.requiredRejections) {
      completedStatus = "REJECTED";
    } else if (decision === "MORE_EVIDENCE") {
      completedStatus = "NEEDS_MORE_EVIDENCE";
    } else if (approvals >= 1) {
      completedStatus = "PARTIALLY_CONFIRMED";
    } else {
      completedStatus = "UNDER_REVIEW";
    }

    const closed = completedStatus === "VERIFIED" || completedStatus === "REJECTED";

    tx.update(caseRef, {
      approvalCount: approvals,
      rejectionCount: rejections,
      moreEvidenceCount: moreEvidence,
      fallbackActivated,
      status: completedStatus,
      disputeNote: completedStatus === "DISPUTED"
        ? "Conflicting approvals and rejections were recorded."
        : current.disputeNote || null,
      resolvedAt: closed ? now : current.resolvedAt || null,
      updatedAt: now,
    });

    tx.set(decisionRef, {
      caseId: caseData.id,
      communityId: caseData.communityId,
      reviewerId: reviewer.uid,
      reviewerRole,
      reviewer,
      decision,
      reason: input.reason || null,
      comments: input.comments || null,
      createdAt: now,
    } satisfies Omit<VerificationDecision, "id">);
tx.set(doc(collection(db, "verificationCases", caseData.id, "events")), {
      caseId: caseData.id,
      communityId: caseData.communityId,
      eventType:
        decision === "APPROVE" ? "REVIEWER_APPROVED"
          : decision === "REJECT" ? "REVIEWER_REJECTED"
            : "MORE_EVIDENCE_REQUESTED",
      text:
        decision === "APPROVE"
          ? `${reviewer.displayName} confirmed the issue looks fixed.`
          : decision === "REJECT"
            ? `${reviewer.displayName} rejected the verification${input.reason ? `: ${input.reason}` : ""}.`
            : `${reviewer.displayName} requested more evidence${input.reason ? `: ${input.reason}` : ""}.`,
      userId: reviewer.uid,
      createdAt: now,
    } satisfies Omit<VerificationCaseEvent, "id">);

    if (fallbackActivated && !current.fallbackActivated && !closed) {
      tx.set(doc(collection(db, "verificationCases", caseData.id, "events")), {
        caseId: caseData.id,
        communityId: caseData.communityId,
        eventType: "FALLBACK_ACTIVATED",
        text: "The owner response window expired - the eligible reviewer quorum is now deciding this case.",
        userId: reviewer.uid,
        createdAt: now,
      } satisfies Omit<VerificationCaseEvent, "id">);
    }

    // Audit record + issue/activity status linkage.
    tx.set(doc(collection(db, "verificationRecords")), {
      communityId: caseData.communityId,
      activityId: caseData.activityId || null,
      submittedBy: reviewer.uid,
      status: completedStatus === "VERIFIED" ? "APPROVED" : completedStatus === "REJECTED" ? "REJECTED" : "PENDING",
      reviewedBy: reviewer.uid,
      notes: `Reviewer ${decision.toLowerCase().replace("_", " ")} - case now ${completedStatus.toLowerCase().replace("_", " ")}${input.reason ? ` (${input.reason})` : ""}.`,
      createdAt: now,
      reviewedAt: now,
    } satisfies Omit<VerificationHistoryEntry, "id">);

    if (closed) {
      tx.update(doc(db, "issueCommunities", caseData.communityId), {
        status: completedStatus === "VERIFIED" ? "VERIFIED" : "IN_PROGRESS",
        updatedAt: now,
      });
    }
  });

  void reviewerRole;

  // Notifications after a successful, committed decision.
  const notifyTargets = new Set<string>();
  if (caseData.primaryReviewerId) notifyTargets.add(caseData.primaryReviewerId);
  caseData.eligibleReviewerIds.forEach((id) => notifyTargets.add(id));

  await Promise.all(
    [...notifyTargets]
      .filter((id) => id !== reviewer.uid)
      .map((id) =>
        createNotification({
          recipientId: id,
          actor: reviewer,
          type: "broadcast",
          text:
            completedStatus === "VERIFIED"
              ? "A verification case was verified."
              : completedStatus === "REJECTED"
                ? "A verification case was rejected."
                : completedStatus === "DISPUTED"
                  ? "A verification case is disputed and needs attention."
                  : `${reviewer.displayName} submitted a verification decision.`,
          link: `/issue-community/${caseData.communityId}?tab=Verification`,
          postId: caseData.postId || undefined,
        }),
      )
  );

  return completedStatus;
}

/**
 * Explicitly activate the owner-inactivity fallback (managers / community
 * moderators when the owner has genuinely not responded). Real deadline only.
 */
export async function activateFallbackVerification(
  caseData: VerificationCase,
  actor: VolunteerUserSummary,
  reason?: string
) {
  const now = serverTimestamp();
  const caseRef = doc(db, "verificationCases", caseData.id);

  await updateDoc(caseRef, {
    fallbackActivated: true,
    ownerResponseDeadline: null,
    updatedAt: now,
  });
  await addDoc(collection(db, "verificationCases", caseData.id, "events"), {
    caseId: caseData.id,
    communityId: caseData.communityId,
    eventType: "OWNER_DEADLINE_EXPIRED",
    text: `Owner response window closed${reason ? ` - ${reason}` : ""}. Verification is now decided by the eligible reviewer quorum.`,
    userId: actor.uid,
    createdAt: now,
  } satisfies Omit<VerificationCaseEvent, "id">);
}

/**
 * A participant who actually performed the work provides witness evidence.
 * Supporting signal only - one witness confirmation per participant.
 */
export async function submitWitnessConfirmation(input: {
  caseData: VerificationCase;
  user: VolunteerUserSummary;
  text: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "text";
}) {
  const { caseData, user } = input;
  const confirmationId = `${caseData.id}_${user.uid}`;
  const confirmationRef = doc(db, "witnessConfirmations", confirmationId);
  const caseRef = doc(db, "verificationCases", caseData.id);
  const now = serverTimestamp();

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(confirmationRef);
    if (existing.exists()) {
      throw new Error("You have already submitted a witness confirmation for this case.");
    }

    const isCommunityMember = (
      await tx.get(doc(db, "communityMembers", memberId(caseData.communityId, user.uid)))
    ).exists();
    const isActivityParticipant = caseData.activityId
      ? (await tx.get(doc(db, "activityParticipants", participantId(caseData.activityId, user.uid)))).exists()
      : false;
    if (!isCommunityMember && !isActivityParticipant) {
      throw new Error("Only community members or activity participants can give witness confirmations.");
    }

    tx.set(confirmationRef, {
      caseId: caseData.id,
      communityId: caseData.communityId,
      activityId: caseData.activityId || null,
      uid: user.uid,
      user,
      text: input.text.trim(),
      mediaUrl: input.mediaUrl || "",
      mediaType: input.mediaType || "text",
      createdAt: now,
    } satisfies Omit<WitnessConfirmation, "id">);
    tx.update(caseRef, {
      witnessConfirmations: increment(1),
      updatedAt: now,
    });
    tx.set(doc(collection(db, "verificationCases", caseData.id, "events")), {
      caseId: caseData.id,
      communityId: caseData.communityId,
      eventType: "WITNESS_CONFIRMATION",
      text: `${user.displayName} provided a witness confirmation.`,
      userId: user.uid,
      createdAt: now,
    } satisfies Omit<VerificationCaseEvent, "id">);
  });
}

/**
 * Community members who visit the location confirm whether the issue looks
 * resolved. Supporting signal only; one confirmation per member (updatable).
 */
export async function submitCommunityConfirmation(input: {
  caseData: VerificationCase;
  user: VolunteerUserSummary;
  resolved: boolean;
  note?: string;
}) {
  const { caseData, user } = input;
  const confirmationId = `${caseData.id}_${user.uid}`;
  const confirmationRef = doc(db, "communityConfirmations", confirmationId);
  const caseRef = doc(db, "verificationCases", caseData.id);
  const now = serverTimestamp();

  await runTransaction(db, async (tx) => {
    const membership = await tx.get(doc(db, "communityMembers", memberId(caseData.communityId, user.uid)));
    if (!membership.exists()) {
      throw new Error("Only community members can confirm from the community.");
    }

    const existing = await tx.get(confirmationRef);
    if (existing.exists()) {
      tx.update(confirmationRef, {
        resolved: input.resolved,
        note: input.note || null,
        updatedAt: now,
      });
      tx.update(caseRef, { updatedAt: now });
      return;
    }

    tx.set(confirmationRef, {
      caseId: caseData.id,
      communityId: caseData.communityId,
      uid: user.uid,
      user,
      resolved: input.resolved,
      note: input.note || null,
      createdAt: now,
    } satisfies Omit<CommunityConfirmation, "id">);
    tx.update(caseRef, {
      communityConfirmations: increment(1),
      updatedAt: now,
    });
    tx.set(doc(collection(db, "verificationCases", caseData.id, "events")), {
      caseId: caseData.id,
      communityId: caseData.communityId,
      eventType: "COMMUNITY_CONFIRMATION",
      text: `${user.displayName} shared a community confirmation.`,
      userId: user.uid,
      createdAt: now,
    } satisfies Omit<VerificationCaseEvent, "id">);
  });
}

/** Reopen a closed or disputed case with a real reason. */
export async function reopenVerificationCase(
  caseData: VerificationCase,
  actor: VolunteerUserSummary,
  reason: string
) {
  const now = serverTimestamp();
  await updateDoc(doc(db, "verificationCases", caseData.id), {
    status: "UNDER_REVIEW",
    disputeNote: null,
    resolvedAt: null,
    updatedAt: now,
  });
  await addDoc(collection(db, "verificationCases", caseData.id, "events"), {
    caseId: caseData.id,
    communityId: caseData.communityId,
    eventType: "VERIFICATION_REOPENED",
    text: `Verification reopened by ${actor.displayName}${reason ? `: ${reason}` : ""}.`,
    userId: actor.uid,
    createdAt: now,
  } satisfies Omit<VerificationCaseEvent, "id">);
}

export function listenCommunityConfirmations(caseId: string, onNext: (confirmations: CommunityConfirmation[]) => void) {
  return onSnapshot(collection(db, "communityConfirmations"), (snapshot) => {
    const data = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() } as CommunityConfirmation))
      .filter((item) => item.caseId === caseId);
    data.sort((a, b) => (a.createdAt?.toDate?.().getTime?.() || 0) - (b.createdAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}


export async function sendGroupMessage(input: {
  groupId: string;
  user: VolunteerUserSummary;
  text: string;
  kind: VolunteerGroupMessage["kind"];
}) {
  await addDoc(collection(db, "volunteerGroupMessages"), {
    groupId: input.groupId,
    uid: input.user.uid,
    user: input.user,
    text: input.text.trim(),
    kind: input.kind,
    createdAt: serverTimestamp(),
  });
}

export function listenGroupMessages(
  groupId: string,
  kind: VolunteerGroupMessage["kind"],
  onNext: (messages: VolunteerGroupMessage[]) => void
) {
  const q = query(
    collection(db, "volunteerGroupMessages"),
    where("groupId", "==", groupId),
    where("kind", "==", kind)
  );
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as VolunteerGroupMessage));
    data.sort((a, b) => (a.createdAt?.toDate?.().getTime?.() || 0) - (b.createdAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}

export async function linkGroupIssue(group: VolunteerGroup, communityId: string) {
  if (group.issueIds.includes(communityId)) return;
  await updateDoc(doc(db, "volunteerGroups", group.id), {
    issueIds: arrayUnion(communityId),
    updatedAt: serverTimestamp(),
  });
}

export async function unlinkGroupIssue(group: VolunteerGroup, communityId: string) {
  await updateDoc(doc(db, "volunteerGroups", group.id), {
    issueIds: arrayRemove(communityId),
    updatedAt: serverTimestamp(),
  });
}
// =====================================================================
// ACTIVITY PARTICIPANTS + ACTIVITY CHAT
// =====================================================================

export function listenActivityParticipants(activityId: string, onNext: (participants: ActivityParticipant[]) => void) {
  const q = query(collection(db, "activityParticipants"), where("activityId", "==", activityId));
  return onSnapshot(q, (snapshot) => {
    onNext(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ActivityParticipant)));
  });
}

/**
 * One listener for every participant across all of a community's actions.
 * Pages pass slices down per activity card instead of opening one query
 * listener per card.
 */
export function listenCommunityParticipants(communityId: string, onNext: (participants: ActivityParticipant[]) => void) {
  const q = query(collection(db, "activityParticipants"), where("communityId", "==", communityId));
  return onSnapshot(q, (snapshot) => {
    onNext(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ActivityParticipant)));
  });
}

export function listenActivityMessages(activityId: string, onNext: (messages: ActivityMessage[]) => void) {
  const q = query(collection(db, "activityMessages"), where("activityId", "==", activityId));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ActivityMessage));
    data.sort((a, b) => (a.createdAt?.toDate?.().getTime?.() || 0) - (b.createdAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}

export async function sendActivityMessage(input: {
  activityId: string;
  communityId: string;
  user: VolunteerUserSummary;
  text: string;
}) {
  await addDoc(collection(db, "activityMessages"), {
    activityId: input.activityId,
    communityId: input.communityId,
    uid: input.user.uid,
    user: input.user,
    text: input.text.trim(),
    kind: "chat",
    createdAt: serverTimestamp(),
  });
}

// =====================================================================
// VERIFICATION HISTORY
// =====================================================================

export function listenVerificationHistory(communityId: string, onNext: (records: VerificationHistoryEntry[]) => void) {
  const q = query(collection(db, "verificationRecords"), where("communityId", "==", communityId));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(
      (item) => ({ id: item.id, ...item.data() } as VerificationHistoryEntry)
    );
    data.sort((a, b) => (b.createdAt?.toDate?.().getTime?.() || 0) - (a.createdAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}

// =====================================================================
// ACTION PARTICIPANT MANAGEMENT
// Authorized managers assign roles / participation states; live profile
// data is resolved in the UI via useLiveProfiles (never stale snapshots).
// =====================================================================

/** Manager assigns/updates a participant's working role. */
export async function assignParticipantRole(input: {
  participant: ActivityParticipant;
  activity: VolunteerActivity;
  role: string;
  manager: VolunteerUserSummary;
}) {
  const { participant, activity, role, manager } = input;
  const trimmed = role.trim();
  if (!trimmed) throw new Error("Role cannot be empty.");
  if (participant.role === trimmed) return;

  await updateDoc(doc(db, "activityParticipants", participantId(activity.id, participant.uid)), {
    role: trimmed,
    responsibility: trimmed,
    assignedBy: manager.uid,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (participant.uid !== manager.uid) {
    await createNotification({
      recipientId: participant.uid,
      actor: manager,
      type: "broadcast",
      text: `${manager.displayName} assigned you the role “${trimmed}” on “${activity.title}”.`,
      link: `/issue-community/${activity.communityId}?tab=Actions`,
    });
  }
}

/** Manager sets participation state (joined/confirmed/completed/no-longer). */
export async function setParticipantStatus(input: {
  participant: ActivityParticipant;
  activity: VolunteerActivity;
  status: ParticipantStatus;
  manager: VolunteerUserSummary;
}) {
  const { participant, activity, status, manager } = input;
  if (participant.participantStatus === status) return;

  await updateDoc(doc(db, "activityParticipants", participantId(activity.id, participant.uid)), {
    participantStatus: status,
    assignedBy: manager.uid,
    assignedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (status === "CONFIRMED" && participant.uid !== manager.uid) {
    await createNotification({
      recipientId: participant.uid,
      actor: manager,
      type: "broadcast",
      text: `Your spot on “${activity.title}” was confirmed.`,
      link: `/issue-community/${activity.communityId}?tab=Actions`,
    });
  }
}

// =====================================================================
// ACTION PROGRESS
// Progress states stay separate from the action lifecycle status.
// =====================================================================

export async function updateActionProgress(input: {
  activity: VolunteerActivity;
  progressState: ActionProgressState;
  progressNote?: string;
  actor: VolunteerUserSummary;
}) {
  const { activity, progressState, progressNote, actor } = input;

  await updateDoc(doc(db, "volunteerActivities", activity.id), {
    progressState,
    progressNote: progressNote?.trim() || null,
    progressUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (activity.organizerId && activity.organizerId !== actor.uid) {
    await createNotification({
      recipientId: activity.organizerId,
      actor,
      type: "broadcast",
      text: `"${activity.title}" progress: ${progressState.replaceAll("_", " ").toLowerCase()}.`,
      link: `/issue-community/${activity.communityId}?tab=Actions`,
    });
  }
}

// =====================================================================
// ACTION CHECKLIST (lightweight, optional)
// Tasks live on the activity document. Manager-only writes: a member
// toggling one task would otherwise rewrite the whole array, so only
// authorized managers edit the checklist. Transactional so two managers
// toggling different tasks never lose an update.
// =====================================================================

export async function addActivityTask(input: {
  activity: VolunteerActivity;
  label: string;
}) {
  const label = input.label.trim();
  if (!label) throw new Error("Task cannot be empty.");
  const tasks = [
    ...(input.activity.tasks || []),
    { id: `t${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, label, done: false },
  ];
  await updateDoc(doc(db, "volunteerActivities", input.activity.id), {
    tasks,
    updatedAt: serverTimestamp(),
  });
}

export async function toggleActivityTask(input: {
  activity: VolunteerActivity;
  index: number;
}) {
  const { activity, index } = input;
  const activityRef = doc(db, "volunteerActivities", activity.id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(activityRef);
    if (!snap.exists()) throw new Error("This action no longer exists.");
    const tasks = [...(((snap.data() as VolunteerActivity).tasks) || [])];
    if (index < 0 || index >= tasks.length) return;
    tasks[index] = { ...tasks[index], done: !tasks[index].done };
    tx.update(activityRef, { tasks, updatedAt: serverTimestamp() });
  });
}

export async function removeActivityTask(input: {
  activity: VolunteerActivity;
  index: number;
}) {
  const { activity, index } = input;
  const activityRef = doc(db, "volunteerActivities", activity.id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(activityRef);
    if (!snap.exists()) return;
    const tasks = [...(((snap.data() as VolunteerActivity).tasks) || [])];
    if (index < 0 || index >= tasks.length) return;
    tasks.splice(index, 1);
    tx.update(activityRef, { tasks, updatedAt: serverTimestamp() });
  });
}

// =====================================================================
// EXTERNAL CONTACT / FOLLOW-UP TRACKING
// Reuses the activityEvidence collection (kind CONTACT_PROOF) with a
// structured `contactUpdate` object - no duplicate collection. These are
// coordination records, not completion proof, so they intentionally do
// NOT create or advance verification cases.
// =====================================================================

export async function logContactUpdate(input: {
  activity: VolunteerActivity;
  user: VolunteerUserSummary;
  contactedOrg: string;
  method: string;
  result: string;
  referenceNumber?: string;
  nextFollowUp?: string;
  notes?: string;
}) {
  const { activity, user } = input;
  const org = input.contactedOrg.trim();
  if (!org) throw new Error("Who was contacted?");
  if (!input.result.trim()) throw new Error("What was the result?");

  await addDoc(collection(db, "activityEvidence"), {
    activityId: activity.id,
    communityId: activity.communityId,
    uid: user.uid,
    user,
    description:
      `${input.method.toUpperCase()} to ${org} - ${input.result.trim()}` +
      (input.referenceNumber ? ` (Ref: ${input.referenceNumber.trim()})` : ""),
    mediaType: "text",
    status: "SUBMITTED",
    evidenceType: "CONTACT_PROOF" satisfies EvidenceTypeKey,
    contactUpdate: {
      contactedOrg: org,
      method: input.method,
      result: input.result.trim(),
      referenceNumber: input.referenceNumber?.trim() || null,
      nextFollowUp: input.nextFollowUp?.trim() || null,
      notes: input.notes?.trim() || null,
    } satisfies ActivityContactUpdate,
    createdAt: serverTimestamp(),
  });

  // Follow-ups due on a specific date ping the organizer once, when logged.
  if (input.nextFollowUp?.trim() && activity.organizerId !== user.uid) {
    await createNotification({
      recipientId: activity.organizerId,
      actor: user,
      type: "broadcast",
      text: `${user.displayName} logged a contact update on “${activity.title}” - follow up ${input.nextFollowUp.trim()}.`,
      link: `/issue-community/${activity.communityId}?tab=Actions`,
    });
  }
}

/** Evidence for one action, newest first (drives the action timeline). */
export function listenActionEvidence(activityId: string, onNext: (evidence: ActivityEvidence[]) => void) {
  const q = query(collection(db, "activityEvidence"), where("activityId", "==", activityId));
  return onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ActivityEvidence));
    data.sort((a, b) => (b.createdAt?.toDate?.().getTime?.() || 0) - (a.createdAt?.toDate?.().getTime?.() || 0));
    onNext(data);
  });
}
