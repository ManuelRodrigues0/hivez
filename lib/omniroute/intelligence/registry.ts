/**
 * Deterministic-first Hive registry search.
 *
 * MANDATORY per architecture: exact name -> aliases -> keywords -> partial
 * match -> token ranking. OmniRoute is only consulted when this produces no
 * strong match. Pure functions, no AI, no I/O.
 */

import type { HiveSnapshot } from "../types.js";

export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s&'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Stop words ignored during token scoring. */
const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "was", "there", "here", "my", "our", "in", "on", "at", "of", "and", "or",
  "to", "for", "with", "from", "near", "outside", "inside", "its", "it", "this", "that", "very", "really",
  "please", "help", "some", "be", "being", "been", "has", "have", "had", "i", "we", "you", "they",
]);

export function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

/** Simple Levenshtein distance capped for typo tolerance on short tokens. */
function editDistanceAtMost2(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  const m = a.length;
  const n = b.length;
  const prev = new Array(n + 1).fill(0).map((_, index) => index);
  for (let i = 1; i <= m; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = temp;
    }
  }
  return prev[n] <= 2;
}

export interface DeterministicCandidate {
  hive: HiveSnapshot;
  score: number;
  matchedVia: "exact_name" | "alias" | "keyword" | "partial" | "tokens";
  detail: string;
}

function scoreAgainstField(query: string, queryTokens: string[], field: string, weight: number): number {
  const normalizedField = normalizeText(field);
  if (!normalizedField) return 0;
  if (normalizedField === query) return weight;
  if (normalizedField.includes(query)) return weight * 0.75;
  const fieldTokens = new Set(normalizeText(field).split(" "));
  let hits = 0;
  for (const token of queryTokens) {
    if (fieldTokens.has(token) || [...fieldTokens].some((fieldToken) => editDistanceAtMost2(fieldToken, token))) {
      hits++;
    }
  }
  return hits > 0 ? weight * 0.55 * (hits / Math.max(1, queryTokens.length)) : 0;
}

/**
 * Scores every hive against the query and returns candidates above the floor,
 * best first. Handles exact names, aliases, keywords, partial substrings,
 * token overlap, and small typos.
 */
export function findDeterministicCandidates(
  query: string,
  registry: HiveSnapshot[],
  minScore: number,
): DeterministicCandidate[] {
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);
  if (!normalizedQuery || queryTokens.length === 0) return [];

  const candidates: DeterministicCandidate[] = [];
  for (const hive of registry) {
    const aliasScores = (hive.aliases ?? []).map((alias) => scoreAgainstField(normalizedQuery, queryTokens, alias, 0.95));
    const keywordScores = (hive.keywords ?? []).map((keyword) =>
      scoreAgainstField(normalizedQuery, queryTokens, keyword, 0.85),
    );
    const bestAlias = aliasScores.length ? Math.max(...aliasScores) : 0;
    const bestKeyword = keywordScores.length ? Math.max(...keywordScores) : 0;

    const nameScore = scoreAgainstField(normalizedQuery, queryTokens, hive.name, 1);
    const descriptionScore = scoreAgainstField(normalizedQuery, queryTokens, hive.description, 0.6);

    let score = Math.max(nameScore, bestAlias, bestKeyword, descriptionScore * 0.8);
    let matchedVia: DeterministicCandidate["matchedVia"] =
      nameScore >= Math.max(bestAlias, bestKeyword, descriptionScore * 0.8)
        ? "exact_name"
        : bestAlias >= bestKeyword
          ? "alias"
          : "keyword";

    if (score < 0.5) {
      // Partial single-token containment, e.g. "garbage" inside "Waste & Garbage".
      const containsQuery = normalizeText(hive.name).includes(normalizedQuery);
      if (containsQuery) {
        score = Math.max(score, 0.7);
        matchedVia = "partial";
      }
    }
    if (matchedVia === "exact_name" && normalizeText(hive.name) !== normalizedQuery && score < 1) {
      matchedVia = "tokens";
    }

    if (score >= minScore) {
      candidates.push({ hive, score: Math.min(1, score), matchedVia, detail: `matched via ${matchedVia}` });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.hive.name.localeCompare(b.hive.name));
  return candidates;
}
