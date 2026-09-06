/**
 * Centralized OmniRoute intelligence configuration.
 *
 * All thresholds, timeouts, cache settings and Hive lifecycle rules live here.
 * No magic numbers are scattered across components or feature modules.
 * (Server-side only - nothing here may reach the browser.)
 */

declare const process: { env: Record<string, string | undefined> };

/** Deterministic search scoring thresholds. */
export const SEARCH_THRESHOLDS = {
  /** Minimum query length before any search runs. */
  minQueryLength: 2,
  /** A deterministic score at or above this is a strong match: never call OmniRoute. */
  strongDeterministicScore: 0.82,
  /** Deterministic candidates below this are not worth returning. */
  minDeterministicScore: 0.18,
  /** Confidence at or above which a semantic match is accepted. */
  semanticMatchConfidence: 0.6,
  /** Below this confidence (several plausible hives) the API asks for clarification. */
  clarificationConfidence: 0.45,
  /** Maximum number of hive candidates sent to OmniRoute. */
  maxCandidates: 8,
  /** Maximum alternative matches returned to the UI. */
  maxAlternatives: 3,
} as const;

/** Analysis thresholds for the new-issue flow. */
export const ANALYSIS_THRESHOLDS = {
  /** Minimum description length for meaningful analysis. */
  minDescriptionLength: 8,
  /** Maximum description characters accepted per request. */
  maxDescriptionLength: 2000,
  /** Maximum image data-URL bytes accepted (approx 1.5 MB base64). */
  maxImageBytes: 1_500_000,
  /** Confidence required before an AI hive proposal is offered to the user. */
  hiveProposalConfidence: 0.55,
} as const;

/** Cache settings for semantic results (query understanding / rewriting / matching). */
export const CACHE_SETTINGS = {
  /** Time-to-live for cached semantic results. */
  ttlMs: 10 * 60 * 1000,
  /** Maximum number of cached entries (simple L-ish eviction). */
  maxEntries: 300,
} as const;

/** Request settings. */
export const REQUEST_SETTINGS = {
  /** Default timeout for one OmniRoute intelligence call. */
  timeoutMs: 25_000,
  /** Maximum registry snapshot entries accepted per request. */
  maxRegistryEntries: 60,
  /** Vercel serverless maxDuration (seconds) for the gateway route. */
  gatewayMaxDuration: 60,
} as const;

/**
 * Hive lifecycle rules. Deliberately configurable, never hardcoded in features.
 * A new hive starts as "provisional"; enough accepted reports promote it.
 */
export const HIVE_LIFECYCLE = {
  /** Reports needed for provisional -> emerging. */
  provisionalToEmergingReports: 3,
  /** Reports needed for emerging -> established. */
  emergingToEstablishedReports: 10,
  /** Lifecycle statuses in promotion order. */
  order: ["provisional", "emerging", "established"] as const,
} as const;

export type HiveLifecycleStatus = (typeof HIVE_LIFECYCLE.order)[number];

/** Returns the next lifecycle status, or null when already established. */
export function nextLifecycleStatus(status: string): HiveLifecycleStatus | null {
  if (status === "provisional") return "emerging";
  if (status === "emerging") return "established";
  return null;
}

/** Returns the report count required to promote OUT of the given status. */
export function promotionThreshold(status: string): number {
  if (status === "provisional") return HIVE_LIFECYCLE.provisionalToEmergingReports;
  if (status === "emerging") return HIVE_LIFECYCLE.emergingToEstablishedReports;
  return Number.POSITIVE_INFINITY;
}

/**
 * Ops supported by the intelligence gateway. Used for allow-listing before
 * dispatch so unknown operations are rejected early.
 */
export const INTELLIGENCE_OPS = [
  "searchHives",
  "analyzeIssue",
  "assistDescription",
  "compareReportsForDuplicates",
] as const;

export type IntelligenceOp = (typeof INTELLIGENCE_OPS)[number];

export function isIntelligenceOp(value: unknown): value is IntelligenceOp {
  return typeof value === "string" && (INTELLIGENCE_OPS as readonly string[]).includes(value);
}

/** Development log helper - safe structured logs, never secrets or raw prompts. */
export function logIntel(scope: string, event: string, data?: Record<string, unknown>): void {
  if (process.env.OMNIROUTE_DEBUG !== "on") return;
  const suffix = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[HIVEZ ${scope}] ${event}${suffix}`);
}
