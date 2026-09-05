/**
 * Verification helpers for the volunteering evidence system.
 *
 * Everything here derives from REAL case data only. There is no AI, no
 * fabricated confidence - confidence is a transparent human-data summary.
 */
import type {
  ActivityEvidence,
  CommunityMember,
  IssueCommunity,
  ReviewerDecision,
  VerificationCase,
  VerificationCaseStatus,
  VerificationConfidenceLevel,
  VerificationDecision,
  VolunteerActivity,
  VolunteerGroupMember,
} from "@/types/volunteering";

export interface VerificationRequirements {
  template: string;
  requiredApprovals: number;
  requiredRejections: number;
  prefersBeforeAfter: boolean;
  prefersLocationConfirmation: boolean;
  description: string;
}

/**
 * Verification requirements per issue category. Defaults to the standard
 * rule: post-owner approval + one authorized reviewer approval = VERIFIED.
 * Larger/sensitive cases require a stronger quorum. Templates are stored on
 * cases at creation time so configurable requirements are possible later.
 */
export function getVerificationRequirements(category?: string | null): VerificationRequirements {
  const cat = (category || "").toLowerCase();

  const beforeAfterCategories = ["garbage", "waste", "cleanup", "roads", "pothole", "street", "water", "infrastructure", "parking", "fallen", "electric", "light"];
  const locationCategories = ["roads", "pothole", "street", "infrastructure", "fallen", "water"];
  const sensitiveCategories = ["blood", "missing", "persons", "pet", "animal", "lost"];

  if (sensitiveCategories.some((key) => cat.includes(key))) {
    return {
      template: "sensitive",
      requiredApprovals: 3,
      requiredRejections: 2,
      prefersBeforeAfter: true,
      prefersLocationConfirmation: true,
      description:
        "Sensitive case - at least three authorized confirmations are required and the issue is never auto-resolved from evidence alone.",
    };
  }

  if (beforeAfterCategories.some((key) => cat.includes(key))) {
    return {
      template: "cleanup",
      requiredApprovals: 2,
      requiredRejections: 2,
      prefersBeforeAfter: true,
      prefersLocationConfirmation: locationCategories.some((key) => cat.includes(key)),
      description:
        "Standard community action - before/after evidence plus a post owner and one authorized reviewer approval are preferred.",
    };
  }

  return {
    template: "standard",
    requiredApprovals: 2,
    requiredRejections: 2,
    prefersBeforeAfter: false,
    prefersLocationConfirmation: false,
    description:
      "Standard verification - post owner approval plus one authorized reviewer approval.",
  };
}

/** Deterministic case id for an activity + community pair. */
export function verificationCaseId(communityId: string, activityId?: string | null): string {
  return activityId ? `vc_${communityId}_${activityId}` : `vc_${communityId}`;
}

/**
 * Resolve the authorized secondary reviewers for a case from the existing
 * volunteering role system. Never lets ordinary members self-promote - only
 * existing community/activity/group organizers and the community owner are
 * considered, plus the activity organizer.
 */
export function resolveEligibleReviewers(input: {
  community?: IssueCommunity | null;
  activity?: VolunteerActivity | null;
  members: CommunityMember[];
  groupMembers?: VolunteerGroupMember[];
}): { ids: string[]; roles: string[] } {
  const ids = new Set<string>();
  const roles = new Set<string>();

  const add = (uid: string | undefined | null, role: string) => {
    if (!uid) return;
    ids.add(uid);
    roles.add(role);
  };

  const community = input.community;
  const activity = input.activity;

  if (community) add(community.ownerId, "community_owner");

  for (const member of input.members) {
    if (member.role === "organizer" || member.role === "moderator") {
      add(member.uid, `community_${member.role}`);
    }
  }

  if (activity) {
    add(activity.organizerId, "activity_organizer");
  }

  if (input.groupMembers) {
    for (const gm of input.groupMembers) {
      if (gm.role === "owner" || gm.role === "organizer") {
        add(gm.uid, `group_${gm.role}`);
      }
    }
  }

  return { ids: [...ids], roles: [...roles] };
}

/**
 * Human verification confidence derived only from real case data.
 * It is informational and never overrides the configured verification rules.
 */
export function computeVerificationConfidence(input: {
  caseData: VerificationCase;
  decisions: VerificationDecision[];
  evidence: ActivityEvidence[];
  communityConfirmations: number;
  witnessConfirmations: number;
}): VerificationConfidenceLevel {
  const { caseData, decisions, evidence, communityConfirmations, witnessConfirmations } = input;

  const ownerApproved = decisions.some(
    (d) => d.decision === "APPROVE" && d.reviewerId === caseData.primaryReviewerId
  );
  const reviewerApprovals = decisions.filter((d) => d.decision === "APPROVE").length;
  const rejections = decisions.filter((d) => d.decision === "REJECT").length;

  if (rejections > 0 && rejections >= caseData.requiredRejections) return "LOW";

  const hasBefore = evidence.some((e) => e.kind === "BEFORE" || e.beforeMediaUrl);
  const hasAfter = evidence.some((e) => e.kind === "AFTER" || e.afterMediaUrl || e.mediaUrl);
  const strongWitnesses = witnessConfirmations >= 2;
  const strongCommunity = communityConfirmations >= 3;

  const quotaMet = reviewerApprovals >= caseData.requiredApprovals;

  if (ownerApproved && quotaMet && (hasBefore || strongWitnesses) && (hasAfter || strongCommunity)) {
    return "HIGH";
  }
  if (ownerApproved || quotaMet || strongCommunity) {
    return "MODERATE";
  }
  return "LOW";
}

/** Light formatting for Firestore timestamps used in timelines. */
export function verificationTimeText(value: { toDate?: () => Date } | null | undefined): string {
  if (!value?.toDate) return "";
  return value.toDate().toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Deadline for the owner response window (ms since epoch). */
export function ownerResponseDeadlineMs(days: number = 7): number {
  return Date.now() + days * 86_400_000;
}

/** User-facing labels for verification case states. */
export function verificationCaseStatusLabel(status: VerificationCaseStatus): string {
  switch (status) {
    case "DRAFT": return "Draft";
    case "SUBMITTED": return "Awaiting evidence";
    case "UNDER_REVIEW": return "Under review";
    case "PARTIALLY_CONFIRMED": return "Partially confirmed";
    case "NEEDS_MORE_EVIDENCE": return "More evidence needed";
    case "DISPUTED": return "Verification disputed";
    case "VERIFIED": return "Verified";
    case "REJECTED": return "Verification rejected";
  }
}

export function reviewerDecisionLabel(decision: ReviewerDecision): string {
  switch (decision) {
    case "APPROVE": return "Confirmed fixed";
    case "REJECT": return "Rejected";
    case "MORE_EVIDENCE": return "More evidence requested";
  }
}

/** Which statuses can still receive reviewer decisions. */
export function isCaseReviewable(status: VerificationCaseStatus): boolean {
  return ["SUBMITTED", "UNDER_REVIEW", "PARTIALLY_CONFIRMED", "NEEDS_MORE_EVIDENCE", "DISPUTED"].includes(status);
}

export function isCaseOpen(status: VerificationCaseStatus): boolean {
  return ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "PARTIALLY_CONFIRMED", "NEEDS_MORE_EVIDENCE", "DISPUTED"].includes(status);
}