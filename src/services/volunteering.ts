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
  ActivityEvidence,
  ActivityMessage,
  ActivityParticipant,
  CommunityMember,
  CommunityMessage,
  CommunityPoll,
  CommunityRole,
  IssueCommunity,
  IssueCommunityStatus,
  PollVote,
  VerificationHistoryEntry,
  VolunteerActivity,
  VolunteerGroup,
  VolunteerGroupMember,
  VolunteerGroupMessage,
  VolunteerUserSummary,
} from "@/types/volunteering";
import { createNotification } from "@/services/notifications";
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
  const ref = await addDoc(collection(db, "activityEvidence"), {
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

  return ref.id;
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
