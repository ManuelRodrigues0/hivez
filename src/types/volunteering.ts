import type { LocationSnapshot } from "@/services/location";

export type CommunityRole = "owner" | "organizer" | "moderator" | "member";

export type IssueCommunityStatus =
  | "REPORTED"
  | "COMMUNITY_VERIFIED"
  | "ACTION_STARTED"
  | "IN_PROGRESS"
  | "AWAITING_VERIFICATION"
  | "RESOLVED"
  | "VERIFIED"
  | "ARCHIVED";

export type VolunteerActivityStatus =
  | "OPEN"
  | "ACTIVE"
  | "AWAITING_VERIFICATION"
  | "VERIFIED"
  | "COMPLETED"
  | "CANCELLED";

export interface VolunteerUserSummary {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
}

export interface IssueCommunity {
  id: string;
  postId: string;
  issueId: string;
  title: string;
  description: string;
  category: string;
  location: string | null;
  locationSnapshot?: LocationSnapshot | null;
  mediaUrl?: string;
  mediaType?: string;
  ownerId: string;
  owner: VolunteerUserSummary;
  status: IssueCommunityStatus;
  memberCount: number;
  activityCount: number;
  rules: string[];
  archived: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface CommunityMember {
  id: string;
  communityId: string;
  uid: string;
  role: CommunityRole;
  user: VolunteerUserSummary;
  joinedAt: any;
}

export interface CommunityMessage {
  id: string;
  communityId: string;
  uid: string;
  user: VolunteerUserSummary;
  text: string;
  kind: "discussion" | "chat" | "announcement";
  createdAt: any;
  deleted?: boolean;
}

export interface CommunityPoll {
  id: string;
  communityId: string;
  question: string;
  options: string[];
  counts: number[];
  totalVotes: number;
  status: "OPEN" | "CLOSED";
  createdBy: string;
  expiresAt?: string | null;
  deleted?: boolean;
  createdAt: any;
}

export interface PollVote {
  id: string;
  pollId: string;
  communityId: string;
  uid: string;
  optionIndex: number;
  createdAt: any;
}

export interface VolunteerActivity {
  id: string;
  communityId: string;
  issueId: string;
  groupId?: string | null;
  title: string;
  description: string;
  category: string;
  organizerId: string;
  organizer: VolunteerUserSummary;
  location: string;
  locationSnapshot?: LocationSnapshot | null;
  meetingPoint: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  volunteerLimit: number;
  volunteerCount: number;
  status: VolunteerActivityStatus;
  urgent: boolean;
  roles: string[];
  requirements: string;
  instructions: string;
  verificationMethod: string;
  evidenceRequirements: string;
  createdAt: any;
  updatedAt: any;
}

export interface ActivityParticipant {
  id: string;
  activityId: string;
  communityId: string;
  uid: string;
  role: string;
  user: VolunteerUserSummary;
  checkedInAt?: any;
  checkedOutAt?: any;
  joinedAt: any;
}

export interface ActivityEvidence {
  id: string;
  activityId: string;
  communityId: string;
  uid: string;
  user: VolunteerUserSummary;
  description: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "document" | "text";
  status: "SUBMITTED" | "REVIEWED" | "ACCEPTED" | "REJECTED";
  reviewedBy?: string;
  reviewedAt?: any;
  createdAt: any;
}

export interface VolunteerGroup {
  id: string;
  name: string;
  description: string;
  location: string;
  ownerId: string;
  owner: VolunteerUserSummary;
  memberCount: number;
  organizers: string[];
  issueIds: string[];
  createdAt: any;
  updatedAt: any;
}

export interface VolunteerGroupMember {
  id: string;
  groupId: string;
  uid: string;
  role: CommunityRole;
  user: VolunteerUserSummary;
  joinedAt: any;
}

export interface VerificationRecord {
  id: string;
  communityId: string;
  activityId?: string | null;
  submittedBy: string;
  verificationType:
    | "VISUAL"
    | "LOCATION"
    | "ORGANIZER_CONFIRMATION"
    | "BENEFICIARY_CONFIRMATION"
    | "CHECK_IN"
    | "AI_ASSISTED";
  status: "PENDING" | "APPROVED" | "REJECTED";
  notes: string;
  aiStatus?: "NOT_STARTED" | "PENDING" | "COMPLETE" | "FAILED";
  aiConfidence?: number | null;
  aiResult?: string | null;
  aiProcessedAt?: any;
  createdAt: any;
  reviewedAt?: any;
}

/**
 * Real-time chat scoped to a single volunteer activity. Only participants
 * (and the activity community's managers) can read or post.
 */
export interface ActivityMessage {
  id: string;
  activityId: string;
  communityId: string;
  uid: string;
  user: VolunteerUserSummary;
  text: string;
  kind: "chat" | "system";
  createdAt: any;
}

/**
 * Group workspace messaging. `kind` mirrors community messages so discussion,
 * chat and announcements share the same collection without a third chat
 * architecture.
 */
export interface VolunteerGroupMessage {
  id: string;
  groupId: string;
  uid: string;
  user: VolunteerUserSummary;
  text: string;
  kind: "discussion" | "chat" | "announcement";
  createdAt: any;
  deleted?: boolean;
}

/**
 * Human/system verification trail. Every evidence submission and review step
 * appends a record so the community keeps a verifiable history without ever
 * auto-verifying an issue from a single submission.
 */
export interface VerificationHistoryEntry {
  id: string;
  communityId: string;
  activityId?: string | null;
  submittedBy: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedBy?: string | null;
  notes: string;
  createdAt: any;
  reviewedAt?: any;
}
