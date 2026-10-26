/**
 * New-issue intelligence.
 *
 * analyzeIssue: existing-hive check -> meaningfulness -> description/image
 * consistency -> normalized Hive proposal. OmniRoute only analyzes; Hivez
 * validates and decides. Never claims objective truth about the user's report.
 *
 * assistDescription: optional wording improvement + completeness hints based
 * strictly on what the user provided. Never invents facts; the user always
 * accepts/edits/discards.
 */

import { callOmniRouteChat } from "../client.js";
import { ANALYSIS_THRESHOLDS, SEARCH_THRESHOLDS, REQUEST_SETTINGS, logIntel } from "../config.js";
import type {
  HiveProposal,
  HiveSnapshot,
  IssueAnalysisResponse,
  DescriptionAssistResponse,
  IssueMeaningfulness,
} from "../types.js";
import { findDeterministicCandidates, hasStrongDeterministicMatch, normalizeText } from "./registry.js";
import {
  extractJsonObject,
  asString,
  asStringArray,
  asConfidence,
  asEnum,
  asBoolean,
} from "./validation.js";

const MEANINGFULNESS_VALUES = [
  "SUPPORTED",
  "UNCERTAIN",
  "NOT_ENOUGH_EVIDENCE",
  "NOT_A_MEANINGFUL_REPORTABLE_ISSUE",
] as const;

function registryDigest(registry: HiveSnapshot[]): string {
  return registry
    .map((hive) => `- id: ${hive.id} | name: ${hive.name} | covers: ${hive.description}`)
    .join("\n");
}

function buildIssuePrompt(description: string, registry: HiveSnapshot[], hasImage: boolean): string {
  return [
    "You analyze a proposed civic/community report for the Hivez app to decide how to route it.",
    "EXISTING HIVES (the only allowed values for existingHiveId):",
    registryDigest(registry),
    "",
    `PROPOSED REPORT DESCRIPTION: "${description}"`,
    hasImage
      ? "An image is attached. Judge ONLY whether the image appears consistent with the description. Never claim the report is objectively true."
      : "No image is attached. Set descriptionImageMatch to null.",
    "",
    "Rules:",
    "- meaningfulness: SUPPORTED (a meaningful community/civic issue), UNCERTAIN, NOT_ENOUGH_EVIDENCE, or NOT_A_MEANINGFUL_REPORTABLE_ISSUE (e.g. personal complaints with no community dimension).",
    "- A private preference or complaint about someone's personal property is NOT a community issue unless the description gives a clear public or shared safety/access impact. Do not call an issue meaningful just because it could be filed as a report.",
    "- Never call the user a liar and never claim truth; assess only the provided information. Do not add location, scale, cause, authority, or urgency that the user did not state.",
    "- existingHiveId: pick an existing hive ONLY if it genuinely covers the issue; otherwise null.",
    "- proposal: only when no existing hive fits AND the issue seems meaningful. Normalize the concept (e.g. broken sign near market/school -> \"Damaged Public Signage\").",
    "- proposal.name: 3-60 chars, Title Case, no location names. proposal.description: 10-300 chars, explains what the hive covers, no invented departments/causes/statistics.",
    "- proposal.aliases: up to 8 common alternate words people use. proposal.keywords: up to 10 search keywords. proposal.confidence: 0-1 confidence that a genuinely new hive is warranted.",
    "- consistencyNote: when descriptionImageMatch is false, one short polite user-safe sentence asking the user to review.",
    'Reply with ONLY JSON: {"meaningfulness":"...","existingHive":{"hiveId":"...","confidence":0.9} or null,' +
      '"descriptionImageMatch":<true|false|null>,"consistencyNote":"..." or null,' +
      '"proposal":{"name":"...","description":"...","aliases":["..."],"keywords":["..."]} or null,' +
      '"summary":"<one concise sentence summarizing only what was provided>"}',
  ].join("\n");
}

function buildAssistPrompt(description: string): string {
  return [
    "You help a user of a civic reporting app write a clearer report description.",
    `USER'S DESCRIPTION: "${description}"`,
    "",
    "Rules:",
    "- Suggest a clearer rewrite using ONLY information the user provided. Never invent measurements, addresses, dates, named places (for example, a street name), causes, people, or any facts.",
    "- Keep the user's meaning. Do not add urgency or drama.",
    "- completenessHints: up to 3 short optional pointers about what the user could add (e.g. which part is affected). Never answer the hints yourself.",
    "- If the description is already clear, return suggestion null.",
    'Reply with ONLY JSON: {"suggestion":"<clearer description>" or null,"completenessHints":["..."]}',
  ].join("\n");
}

interface IssuePayload {
  meaningfulness?: unknown;
  existingHive?: unknown;
  descriptionImageMatch?: unknown;
  consistencyNote?: unknown;
  proposal?: unknown;
  summary?: unknown;
}

interface AssistPayload {
  suggestion?: unknown;
  completenessHints?: unknown;
}

function uncertainIssueResult(): Extract<IssueAnalysisResponse, { ok: true }> {
  return {
    ok: true,
    meaningfulness: "UNCERTAIN",
    descriptionImageMatch: null,
    consistencyNote: null,
    existingHiveId: null,
    existingHiveConfidence: null,
    proposal: null,
  };
}

/** Narrow deterministic guard for an explicitly personal complaint without a public impact. */
function isClearlyPersonalNonCivicComplaint(description: string): boolean {
  const text = normalizeText(description);
  const privateItem = /\b(my|our)\s+(car|phone|laptop|computer|tablet|television|tv|room|kitchen|internet|wifi)\b/;
  const complaint = /\b(annoying|annoys me|bothers me|hate|do not like|don't like|not happy with|wish i could)\b/;
  const publicImpact = /\b(public|shared|street|road|sidewalk|pavement|crosswalk|bus stop|park|school|playground|neighbourhood|neighborhood|community|blocking|blocked|unsafe|hazard|leak|dump|garbage|waste|pothole|broken pipe|streetlight|street light)\b/;
  return privateItem.test(text) && complaint.test(text) && !publicImpact.test(text);
}

/** Rejects rewrites that introduce numbers or likely proper place names absent from the source. */
function suggestionAddsUnprovidedSpecifics(suggestion: string, source: string): boolean {
  const sourceNormalized = normalizeText(source);
  const numbers = suggestion.match(/\b\d+(?:[.,]\d+)?\b/g) ?? [];
  if (numbers.some((number) => !source.includes(number))) return true;

  const placeLike = /\b(?:[A-Z][a-z]+(?:['’-][A-Z]?[a-z]+)?(?:\s+[A-Z][a-z]+(?:['’-][A-Z]?[a-z]+)?){0,2})\b/g;
  for (const match of suggestion.matchAll(placeLike)) {
    const value = match[0];
    const offset = match.index ?? 0;
    const atSentenceStart = offset === 0 || /[.!?]\s*$/.test(suggestion.slice(0, offset));
    if (atSentenceStart && value.split(/\s+/).length === 1) continue;
    if (!sourceNormalized.includes(normalizeText(value))) return true;
  }
  return false;
}

/** Validates and normalizes an AI hive proposal; null when not acceptable. */
function validateProposal(raw: unknown, confidenceGate: number, confidence: number | null): HiveProposal | null {
  if (!raw || typeof raw !== "object" || (confidence !== null && confidence < confidenceGate)) return null;
  const record = raw as Record<string, unknown>;
  const name = asString(record.name, 60);
  const description = asString(record.description, 300);
  if (!name || !description || name.length < 3 || description.length < 10) return null;
  const aliases = asStringArray(record.aliases, 8, 40);
  const keywords = asStringArray(record.keywords, 10, 30);
  return { name, description, aliases, keywords };
}
export interface AnalyzeIssueInput {
  description: string;
  imageDataUrl?: string | null;
  registry: HiveSnapshot[];
}

/**
 * Full new-issue analysis. Deterministic existing-hive check first; OmniRoute
 * only when the description does not already match a hive strongly. On
 * OmniRoute failure returns ok:false so the UI can allow manual continuation.
 */
export async function analyzeIssue(input: AnalyzeIssueInput): Promise<IssueAnalysisResponse> {
  const description = input.description.trim();
  if (description.length < ANALYSIS_THRESHOLDS.minDescriptionLength) {
    return { ok: false, error: "invalid_input", message: "Description is too short to analyze." };
  }
  if (description.length > ANALYSIS_THRESHOLDS.maxDescriptionLength) {
    return { ok: false, error: "invalid_input", message: "Description is too long to analyze." };
  }

  const imageDataUrl = input.imageDataUrl && input.imageDataUrl.startsWith("data:image/") ? input.imageDataUrl : null;
  if (imageDataUrl && imageDataUrl.length > ANALYSIS_THRESHOLDS.maxImageBytes) {
    return { ok: false, error: "invalid_input", message: "Image is too large to analyze." };
  }

  if (isClearlyPersonalNonCivicComplaint(description)) {
    return {
      ok: true,
      meaningfulness: "NOT_A_MEANINGFUL_REPORTABLE_ISSUE",
      descriptionImageMatch: null,
      consistencyNote: null,
      existingHiveId: null,
      existingHiveConfidence: null,
      proposal: null,
    };
  }

  // 1. Deterministic existing-hive check (no AI).
  const deterministic = findDeterministicCandidates(description, input.registry, SEARCH_THRESHOLDS.minDeterministicScore);
  const best = deterministic[0];
  if (best && hasStrongDeterministicMatch(deterministic, SEARCH_THRESHOLDS.strongDeterministicScore)) {
    logIntel("NewHive", "Existing Hive match found", { hiveId: best.hive.id, via: best.matchedVia });
    return {
      ok: true,
      meaningfulness: "SUPPORTED",
      descriptionImageMatch: null,
      consistencyNote: null,
      existingHiveId: best.hive.id,
      existingHiveConfidence: Math.round(best.score * 100) / 100,
      proposal: null,
    };
  }

  logIntel("NewHive", deterministic.length ? "Weak deterministic matches; analyzing with OmniRoute" : "No existing Hive matched");

  // 2. OmniRoute analysis (text, plus image only when this feature needs it).
  const content =
    imageDataUrl
      ? [
          { type: "text" as const, text: buildIssuePrompt(description, input.registry, true) },
          { type: "image_url" as const, image_url: { url: imageDataUrl } },
        ]
      : buildIssuePrompt(description, input.registry, false);

  let response = await callOmniRouteChat({
    messages: [{ role: "user", content }],
    temperature: 0.2,
    maxTokens: 700,
    timeoutMs: REQUEST_SETTINGS.timeoutMs,
    responseFormat: "json_object",
  });

  // Graceful image fallback: some upstreams cannot process image_url content
  // parts. Retry text-only; descriptionImageMatch stays null because the image
  // could not be analyzed (never fabricate a consistency verdict).
  if (!response.ok && imageDataUrl) {
    logIntel("NewHive", "Image analysis unavailable; retrying text-only", { error: response.error });
    response = await callOmniRouteChat({
      messages: [{ role: "user", content: buildIssuePrompt(description, input.registry, false) }],
      temperature: 0.2,
      maxTokens: 700,
      timeoutMs: REQUEST_SETTINGS.timeoutMs,
      responseFormat: "json_object",
    });
  }

  if (!response.ok) {
    logIntel("NewHive", "Analysis unavailable", { error: response.error });
    return { ok: false, error: response.error, message: response.message };
  }

  const payload = extractJsonObject(response.text) as IssuePayload | null;
  if (!payload) {
    logIntel("NewHive", "Analysis response could not be parsed; returning a safe uncertain result");
    return uncertainIssueResult();
  }

  const byId = new Map(input.registry.map((hive) => [hive.id, hive]));
  const meaningfulness = asEnum<IssueMeaningfulness>(payload.meaningfulness, MEANINGFULNESS_VALUES);
  if (!meaningfulness) {
    logIntel("NewHive", "Analysis meaning was missing; returning a safe uncertain result");
    return uncertainIssueResult();
  }

  // Existing-hive answer is only kept when the id really exists in the registry.
  let existingHiveId: string | null = null;
  let existingHiveConfidence: number | null = null;
  if (payload.existingHive && typeof payload.existingHive === "object") {
    const record = payload.existingHive as Record<string, unknown>;
    const hiveId = asString(record.hiveId, 120);
    if (hiveId && byId.has(hiveId)) {
      existingHiveId = hiveId;
      existingHiveConfidence = asConfidence(record.confidence);
    }
  }

  // Description/image consistency is only meaningful when an image was supplied.
  const imageFlag = asBoolean(payload.descriptionImageMatch);
  const descriptionImageMatch = imageDataUrl ? imageFlag : null;
  const consistencyNote =
    descriptionImageMatch === false
      ? asString(payload.consistencyNote, 200) ??
        "This description and image do not appear to describe the same issue. Please review them."
      : null;

  // A proposal is only considered when nothing fits, the issue appears
  // meaningful, and the supplied evidence is not inconsistent.
  const proposalRecord =
    existingHiveId === null && meaningfulness === "SUPPORTED" && descriptionImageMatch !== false
      ? payload.proposal
      : null;
  const proposal =
    proposalRecord && typeof proposalRecord === "object"
      ? validateProposal(
          proposalRecord,
          ANALYSIS_THRESHOLDS.hiveProposalConfidence,
          asConfidence((proposalRecord as Record<string, unknown>).confidence),
        )
      : null;

  // Hard duplicate guard: never propose a hive whose name or alias duplicates an
  // existing hive. AI output becomes a database entity only through validation.
  const finalProposal =
    proposal && !proposalIsDuplicate(proposal.name, input.registry) ? proposal : null;

  logIntel("NewHive", "Proposed normalized Hive", finalProposal ? { name: finalProposal.name } : { proposal: false });

  return {
    ok: true,
    meaningfulness,
    descriptionImageMatch,
    consistencyNote,
    existingHiveId,
    existingHiveConfidence,
    proposal: finalProposal,
  };
}

/** True when the proposed hive name matches an existing hive name or alias. */
function proposalIsDuplicate(name: string, registry: HiveSnapshot[]): boolean {
  const normalized = normalizeText(name);
  return registry.some(
    (hive) =>
      normalizeText(hive.name) === normalized ||
      (hive.aliases ?? []).some((alias) => normalizeText(alias) === normalized),
  );
}

const BRIEF_DESCRIPTION_HINT =
  "Your description is very brief. Adding what is happening, where it is, and what is affected may make the report clearer.";
const SAFE_ASSIST_FALLBACK_HINT =
  "If you can, add what is affected and where it is. Only include details you know.";

export interface AssistDescriptionInput {
  description: string;
}

/**
 * Optional wording assistance. Returns a suggestion the user may accept, edit,
 * or discard; suggestions use ONLY what the user provided and the user's
 * original text is never modified by this layer.
 */
export async function assistDescription(input: AssistDescriptionInput): Promise<DescriptionAssistResponse> {
  const description = input.description.trim();
  if (description.length < ANALYSIS_THRESHOLDS.minDescriptionLength) {
    return { ok: true, suggestion: null, completenessHints: [BRIEF_DESCRIPTION_HINT] };
  }
  if (description.length > ANALYSIS_THRESHOLDS.maxDescriptionLength) {
    return { ok: false, error: "invalid_input", message: "Description is too long to assist with." };
  }

  logIntel("OmniRoute", "Description assistance started");
  const response = await callOmniRouteChat({
    messages: [{ role: "user", content: buildAssistPrompt(description) }],
    temperature: 0.3,
    maxTokens: 350,
    timeoutMs: REQUEST_SETTINGS.timeoutMs,
    responseFormat: "json_object",
  });
  if (!response.ok) {
    logIntel("OmniRoute", "Description assistance unavailable", { error: response.error });
    return { ok: false, error: response.error, message: response.message };
  }

  const payload = extractJsonObject(response.text) as AssistPayload | null;
  if (!payload) {
    logIntel("OmniRoute", "Description assistance response was invalid; returning a safe hint");
    return { ok: true, suggestion: null, completenessHints: [SAFE_ASSIST_FALLBACK_HINT] };
  }

  const rawSuggestion = asString(payload.suggestion, ANALYSIS_THRESHOLDS.maxDescriptionLength);
  const suggestion = rawSuggestion && !suggestionAddsUnprovidedSpecifics(rawSuggestion, description) ? rawSuggestion : null;
  const hints = asStringArray(payload.completenessHints, 3, 140);
  logIntel("OmniRoute", "Description assistance completed", { hasSuggestion: suggestion !== null, hints: hints.length });
  return {
    ok: true,
    // Never suggest the identical text back.
    suggestion: suggestion && suggestion !== description ? suggestion : null,
    completenessHints: hints,
  };
}

