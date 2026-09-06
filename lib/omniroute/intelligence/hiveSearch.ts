/**
 * Hive search intelligence.
 *
 * Deterministic-first: strong registry matches never touch OmniRoute. Only
 * weak/ambiguous queries trigger the semantic fallback, which maps the user's
 * messy wording onto EXISTING hives (query understanding, rewriting, related
 * suggestions, clarification) and never proposes creating anything.
 */

import { callOmniRouteChat } from "../client.js";
import { SEARCH_THRESHOLDS, REQUEST_SETTINGS, logIntel } from "../config.js";
import type { HiveMatch, HiveSearchResult, HiveSearchFailure, HiveSnapshot, SearchMatchType } from "../types.js";
import { findDeterministicCandidates, tokenize } from "./registry.js";
import { extractJsonObject, asString, asStringArray, asConfidence } from "./validation.js";
import { cacheKey, getCached, setCached, registryVersion } from "./cache.js";

function buildRegistryDigest(registry: HiveSnapshot[]): string {
  return registry
    .map(
      (hive) =>
        `- id: ${hive.id} | name: ${hive.name} | status: ${hive.status}` +
        (hive.aliases?.length ? ` | aliases: ${hive.aliases.join(", ")}` : "") +
        (hive.keywords?.length ? ` | keywords: ${hive.keywords.join(", ")}` : "") +
        ` | covers: ${hive.description}`,
    )
    .join("\n");
}

function buildSearchPrompt(query: string, registry: HiveSnapshot[], prefilteredIds: string[]): string {
  const focus = registry.filter((hive) => prefilteredIds.includes(hive.id));
  return [
    "You help a civic reporting app understand what Hive (report category/community) a user's search refers to.",
    "HIVES (the only allowed values for hiveId):",
    buildRegistryDigest(focus.length ? focus : registry),
    "",
    `USER SEARCH TEXT: "${query}"`,
    "",
    "Rules:",
    "- Understand colloquial wording, spelling mistakes, and alternate phrasing.",
    "- Map the search to existing hives ONLY. Never invent hives or ids.",
    "- reason must be one short user-safe sentence (e.g. \"Query describes water escaping from a pipe.\").",
    "- Do not expose reasoning steps; only the short reason.",
    "- If two or more very different hives are plausible, set needsClarification true.",
    'Reply with ONLY JSON: {"intent":"<2-5 word intent>","concepts":["<normalized search concepts>"],' +
      '"matches":[{"hiveId":"<id>","confidence":<0-1>,"reason":"<short reason>"}],"needsClarification":<true|false>}',
    "- Maximum 4 matches, best first, confidence 0-1.",
  ].join("\n");
}

interface SemanticSearchPayload {
  intent?: unknown;
  concepts?: unknown;
  matches?: unknown;
  needsClarification?: unknown;
}

function mapDeterministicToMatches(
  candidates: ReturnType<typeof findDeterministicCandidates>,
  limit: number,
): HiveMatch[] {
  return candidates.slice(0, limit).map((candidate, index) => ({
    matchType:
      index === 0 && candidate.score >= SEARCH_THRESHOLDS.strongDeterministicScore
        ? "existing_hive"
        : "related_hive",
    hiveId: candidate.hive.id,
    confidence: Math.round(candidate.score * 100) / 100,
    reason:
      candidate.matchedVia === "exact_name"
        ? "Matches the hive name."
        : candidate.matchedVia === "alias"
          ? "Matches a known alias of this hive."
          : candidate.matchedVia === "keyword"
            ? "Matches search keywords of this hive."
            : "Partially matches this hive.",
  }));
}
/**
 * Full search pipeline. Returns clean Hivez-level results; on any OmniRoute
 * problem it degrades to the deterministic result (or empty) instead of failing.
 */
export async function searchHives(
  query: string,
  registry: HiveSnapshot[],
): Promise<HiveSearchResult | HiveSearchFailure> {
  const trimmed = query.trim();
  if (trimmed.length < SEARCH_THRESHOLDS.minQueryLength) {
    return { ok: true, matches: [], queryConcepts: [], cached: false };
  }

  // 1. Deterministic pass (never calls AI).
  const deterministic = findDeterministicCandidates(trimmed, registry, SEARCH_THRESHOLDS.minDeterministicScore);
  const best = deterministic[0];
  if (best && best.score >= SEARCH_THRESHOLDS.strongDeterministicScore) {
    logIntel("HiveSearch", "Deterministic match found", { matchedVia: best.matchedVia, score: best.score });
    return {
      ok: true,
      matches: mapDeterministicToMatches(deterministic, SEARCH_THRESHOLDS.maxAlternatives),
      queryConcepts: [],
      cached: false,
    };
  }

  // 2. Semantic fallback with caching (keyed by query + registry version).
  const version = registryVersion(registry);
  const key = cacheKey("search", version, trimmed.toLowerCase());
  const cached = getCached<HiveSearchResult>(key);
  if (cached) {
    logIntel("HiveSearch", "Semantic cache hit");
    return { ...cached, cached: true };
  }

  logIntel("HiveSearch", "Semantic fallback triggered", { candidates: deterministic.length });

  // Build a SMALL focus set for the prompt: deterministic candidates plus any
  // hive sharing a query token. A focused digest keeps the routed model fast
  // and produces clean JSON instead of slow/hallucinated prose.
  const queryTokens = tokenize(trimmed);
  const overlapIds: string[] = [];
  if (queryTokens.length > 0) {
    for (const hive of registry) {
      const haystack = `${hive.name} ${(hive.aliases ?? []).join(" ")} ${(hive.keywords ?? []).join(" ")}`.toLowerCase();
      if (queryTokens.some((token) => haystack.includes(token))) {
        overlapIds.push(hive.id);
      }
    }
  }
  const prefiltered = Array.from(
    new Set([...deterministic.map((candidate) => candidate.hive.id), ...overlapIds]),
  ).slice(0, SEARCH_THRESHOLDS.maxCandidates);
  const prompt = buildSearchPrompt(trimmed, registry, prefiltered);

  const response = await callOmniRouteChat({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    maxTokens: 400,
    timeoutMs: REQUEST_SETTINGS.timeoutMs,
  });

  // 3. Graceful degradation: deterministic results remain available.
  if (!response.ok) {
    logIntel("HiveSearch", "Semantic fallback unavailable", { error: response.error });
    const fallback = mapDeterministicToMatches(deterministic, SEARCH_THRESHOLDS.maxAlternatives);
    return { ok: true, matches: fallback, queryConcepts: [], cached: false };
  }

  const payload = extractJsonObject(response.text) as SemanticSearchPayload | null;
  if (!payload) {
    logIntel("HiveSearch", "Semantic response invalid JSON");
    const fallback = mapDeterministicToMatches(deterministic, SEARCH_THRESHOLDS.maxAlternatives);
    return { ok: true, matches: fallback, queryConcepts: [], cached: false };
  }

  // 4. Validate AI output against the actual registry (ids must exist).
  const byId = new Map(registry.map((hive) => [hive.id, hive]));
  const rawMatches = Array.isArray(payload.matches) ? payload.matches : [];
  const semanticMatches: HiveMatch[] = [];
  for (const entry of rawMatches.slice(0, 4)) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const hiveId = asString(record.hiveId, 120);
    const confidence = asConfidence(record.confidence);
    const reason = asString(record.reason, 200) ?? "Appears to match this hive.";
    if (!hiveId || confidence === null || !byId.has(hiveId)) continue;
    const matchType: SearchMatchType =
      semanticMatches.length === 0 && confidence >= SEARCH_THRESHOLDS.semanticMatchConfidence
        ? "semantic_hive"
        : "related_hive";
    semanticMatches.push({ matchType, hiveId, confidence, reason });
  }
  semanticMatches.sort((a, b) => b.confidence - a.confidence);

  // 5. Clarification when ambiguity is material (never blind-guess).
  const top = semanticMatches[0];
  const second = semanticMatches[1];
  const ambiguous =
    asString(payload.needsClarification, 8) === "true" ||
    (Boolean(top && second) && Boolean(top) && Boolean(second) &&
      (top as HiveMatch).confidence < SEARCH_THRESHOLDS.strongDeterministicScore &&
      (second as HiveMatch).confidence >= (top as HiveMatch).confidence * 0.8);

  let matches: HiveMatch[] = semanticMatches;
  if (ambiguous && top && top.confidence < SEARCH_THRESHOLDS.clarificationConfidence) {
    matches = [
      { ...top, matchType: "clarification_needed" },
      ...semanticMatches.slice(1, SEARCH_THRESHOLDS.maxAlternatives + 1),
    ];
  }
  matches = matches.slice(0, SEARCH_THRESHOLDS.maxAlternatives + 1);

  const result: HiveSearchResult = {
    ok: true,
    matches,
    queryConcepts: asStringArray(payload.concepts, 6, 40),
    cached: false,
  };
  if (matches.length > 0 || result.queryConcepts.length > 0) {
    setCached(key, result);
  }
  logIntel("HiveSearch", "Semantic fallback completed", { matches: matches.length });
  return result;
}

