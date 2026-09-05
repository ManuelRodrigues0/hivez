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
  // ---- Verification case integration (optional, backwards-compatible) ----
  caseId?: string | null;
  kind?: VerificationEvidenceKind | null;
  beforeMediaUrl?: string | null;
  afterMediaUrl?: string | null;
  completedAt?: string | null;
  locationLabel?: string | null;
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

// =====================================================================
// VERIFICATION CASE SYSTEM
// =====================================================================

export type VerificationCaseStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "PARTIALLY_CONFIRMED"
  | "NEEDS_MORE_EVIDENCE"
  | "DISPUTED"
  | "VERIFIED"
  | "REJECTED";

export type ReviewerDecision = "APPROVE" | "REJECT" | "MORE_EVIDENCE";

export type VerificationConfidenceLevel = "LOW" | "MODERATE" | "HIGH";

export type VerificationEvidenceKind =
  | "BEFORE"
  | "AFTER"
  | "REPORT"
  | "WITNESS"
  | "COMMUNITY"
  | "SUPPORTING";

/**
 * A verification case ties an issue community (and optionally a specific
 * volunteer activity) to all the evidence, reviewer decisions, witness and
 * community confirmations required to verify an issue was resolved.
 *
 * The configuration lives on the case (`verificationTemplate`,
 * `requiredApprovals`, `requiredRejections`, `primaryReviewerId`,
 * `ownerResponseDeadline`) so rules can be adjusted per issue without
 * hardcoding one flow forever.
 */
export interface VerificationCase {
  id: string;
  issueId: string;
  postId: string;
  communityId: string;
  activityId?: string | null;
  groupId?: string | null;

  status: VerificationCaseStatus;

  verificationTemplate: string;
  requiredApprovals: number;
  requiredRejections: number;

  /** Number of distinct eligible review sources (owner + authorized reviewers). */
  reviewerQuorum: number;

  /** The original post author - always the primary verifier when available. */
  primaryReviewerId?: string | null;
  primaryReviewerRole?: string | null;

  /** Authorized secondary reviewers, resolved from existing volunteering roles. */
  eligibleReviewerIds: string[];
  eligibleReviewerRoles: string[];

  evidenceIds: string[];

  approvalCount: number;
  rejectionCount: number;
  moreEvidenceCount: number;

  /** Milliseconds since epoch - owner must respond before this. */
  ownerResponseDeadline?: number | null;
  /** True when the owner deadline expired and fallback mode is active. */
  fallbackActivated?: boolean;
  /** Note explaining why the case entered DISPUTED. */
  disputeNote?: string | null;

  /** Community members who confirmed resolution (supporting signal only). */
  communityConfirmations: number;
  /** Activity participants who provided witness confirmation (supporting). */
  witnessConfirmations: number;

  createdAt: any;
  submittedAt?: any;
  resolvedAt?: any;
  updatedAt: any;
}

/**
 * Immutable reviewer decision attached to a verification case.
 * Stored as `verificationCases/{caseId}/decisions/{caseId}_{reviewerUid}`
 * so a reviewer can decide once and a record can never be silently altered.
 */
export interface VerificationDecision {
  id: string;
  caseId: string;
  communityId: string;
  reviewerId: string;
  reviewerRole: string;
  reviewer: VolunteerUserSummary;
  decision: ReviewerDecision;
  reason?: string | null;
  comments?: string | null;
  createdAt: any;
}

/**
 * Append-only timeline entries for a verification case. All real events,
 * using real existing timestamps - never fabricated.
 */
export interface VerificationCaseEvent {
  id: string;
  caseId: string;
  communityId: string;
  eventType:
    | "CASE_CREATED"
    | "EVIDENCE_SUBMITTED"
    | "EVIDENCE_UPDATED"
    | "REVIEWER_ASSIGNED"
    | "REVIEWER_APPROVED"
    | "REVIEWER_REJECTED"
    | "MORE_EVIDENCE_REQUESTED"
    | "WITNESS_CONFIRMATION"
    | "COMMUNITY_CONFIRMATION"
    | "OWNER_DEADLINE_EXPIRED"
    | "FALLBACK_ACTIVATED"
    | "VERIFICATION_DISPUTED"
    | "VERIFICATION_COMPLETED"
    | "VERIFICATION_REJECTED"
    | "VERIFICATION_REOPENED";
  text: string;
  userId?: string | null;
  createdAt: any;
}

/**
 * A supporting confirmation from an eligible community member that they
 * visited the location and the issue appears resolved (or not).
 * Supporting signal only - never a substitute for official approval.
 */
export interface CommunityConfirmation {
  id: string;
  caseId: string;
  communityId: string;
  uid: string;
  user: VolunteerUserSummary;
  resolved: boolean;
  note?: string | null;
  createdAt: any;
}

/**
 * A supporting confirmation from an activity participant who witnessed the
 * result. Supporting signal only.
 */
export interface WitnessConfirmation {
  id: string;
  caseId: string;
  communityId: string;
  activityId?: string | null;
  uid: string;
  user: VolunteerUserSummary;
  text: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "text";
  createdAt: any;
}

/** Options for negative reviewer decisions, presented to the reviewer. */
export const REJECT_REASONS = [
  "Issue is still visible",
  "Evidence is unclear",
  "Evidence does not match the original location",
  "Wrong issue",
  "Insufficient evidence",
  "Evidence appears unrelated",
  "Other",
] as const;

export const MORE_EVIDENCE_REASONS = [
  "Need clearer after photos",
  "Need additional viewpoints",
  "Need location confirmation",
  "Need completion details",
  "Need supporting documentation",
  "Other",
] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];
export type MoreEvidenceReason = (typeof MORE_EVIDENCE_REASONS)[number];

/** Default owner response window used when creating a case. */
export const OWNER_RESPONSE_DEADLINE_DAYS = 7;
