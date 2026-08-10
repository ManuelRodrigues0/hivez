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
