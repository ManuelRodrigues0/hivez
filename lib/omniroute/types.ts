/**
 * Shared types for the OmniRoute intelligence layer.
 *
 * These are Hivez-level concepts: the UI receives clean results
 * (matchType / hiveId / confidence / reason) and never sees provider,
 * model, or OmniRoute internals. All AI output is validated into these
 * shapes before it leaves the server.
 */

/** Lifecycle status of a Hive in the central registry. */
export type HiveStatus = "provisional" | "emerging" | "established";

/**
 * One searchable Hive entry from the central registry. Established hives come
 * from the app's community constant; provisional/emerging hives come from the
 * Firestore `hives` collection. Only public hive data is ever sent to the
 * intelligence API.
 */
export interface HiveSnapshot {
  id: string;
  name: string;
  description: string;
  aliases?: string[];
  keywords?: string[];
  status: HiveStatus;
  reportCount?: number;
}

/** How a search match was produced. */
export type SearchMatchType = "existing_hive" | "related_hive" | "semantic_hive" | "clarification_needed";

/** One hive match with a user-safe explanation. */
export interface HiveMatch {
  matchType: SearchMatchType;
  hiveId: string;
  confidence: number;
  reason: string;
}

/** Clean search result returned to the UI. */
export interface HiveSearchResult {
  ok: true;
  matches: HiveMatch[];
  /** Normalized search concepts derived from the query (original is never replaced). */
  queryConcepts: string[];
  /** True when results were served from cache. */
  cached: boolean;
}

export type HiveSearchFailure = { ok: false; error: string; message: string };
export type HiveSearchResponse = HiveSearchResult | HiveSearchFailure;

/** Meaningfulness verdict for a proposed new issue (never claims objective truth). */
export type IssueMeaningfulness =
  | "SUPPORTED"
  | "UNCERTAIN"
  | "NOT_ENOUGH_EVIDENCE"
  | "NOT_A_MEANINGFUL_REPORTABLE_ISSUE";

/** Normalized hive proposal produced for a genuinely new issue. */
export interface HiveProposal {
  name: string;
  description: string;
  aliases: string[];
  keywords: string[];
}

/** Clean new-issue analysis returned to the UI. */
export interface IssueAnalysisResult {
  ok: true;
  meaningfulness: IssueMeaningfulness;
  /** Whether the supplied description and image appear to describe the same issue (null when no image). */
  descriptionImageMatch: boolean | null;
  /** User-safe note when description/image seem inconsistent. */
  consistencyNote: string | null;
  /** Best existing hive that already covers the issue, if any. */
  existingHiveId: string | null;
  existingHiveConfidence: number | null;
  /** Normalized new-hive proposal; only present when existing hives genuinely do not fit. */
  proposal: HiveProposal | null;
}

export type IssueAnalysisFailure = { ok: false; error: string; message: string };
export type IssueAnalysisResponse = IssueAnalysisResult | IssueAnalysisFailure;

/** Optional description improvement suggestion (user must accept/edit/discard). */
export interface DescriptionAssistResult {
  ok: true;
  suggestion: string | null;
  /** Brief missing-information hints; the system never invents the answers. */
  completenessHints: string[];
}

export type DescriptionAssistFailure = { ok: false; error: string; message: string };
export type DescriptionAssistResponse = DescriptionAssistResult | DescriptionAssistFailure;

/** Duplicate/related verdict between two reports. */
export type DuplicateVerdict = "POTENTIAL_DUPLICATE" | "RELATED" | "UNRELATED";

export interface DuplicateCompareResult {
  ok: true;
  verdict: DuplicateVerdict;
  confidence: number;
  reason: string;
}

export type DuplicateCompareFailure = { ok: false; error: string; message: string };
export type DuplicateCompareResponse = DuplicateCompareResult | DuplicateCompareFailure;

/** Union of all gateway responses. */
export type IntelligenceResponse =
  | HiveSearchResponse
  | IssueAnalysisResponse
  | DescriptionAssistResponse
  | DuplicateCompareResponse;
