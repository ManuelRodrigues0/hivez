/**
 * Semantic duplicate / related-report analysis (OmniRoute only).
 *
 * Compares two reports and classifies them as POTENTIAL_DUPLICATE, RELATED, or
 * UNRELATED. OmniRoute never deletes, merges, or rejects anything - Hivez makes
 * the final operational decision. Deterministic candidate filtering (same hive,
 * geo/time proximity) is expected to happen in Hivez before this is invoked.
 */

import { callOmniRouteChat } from "../client.js";
import { REQUEST_SETTINGS, logIntel } from "../config.js";
import type { DuplicateCompareResponse, DuplicateVerdict } from "../types.js";
import { extractJsonObject, asString, asConfidence, asEnum } from "./validation.js";
import { normalizeText, tokenize } from "./registry.js";

const VERDICT_VALUES = ["POTENTIAL_DUPLICATE", "RELATED", "UNRELATED"] as const;

export interface ReportForComparison {
  title?: string | null;
  description: string;
}

function buildComparePrompt(a: ReportForComparison, b: ReportForComparison): string {
  return [
    "You compare two community reports for a civic reporting app to decide whether they probably describe the same underlying issue.",
    "This is a similarity judgment based only on the provided text - never claim either report is objectively true or false.",
    "",
    `REPORT A: ${a.title ? `"${a.title}" - ` : ""}"${a.description}"`,
    `REPORT B: ${b.title ? `"${b.title}" - ` : ""}"${b.description}"`,
    "",
    "Rules:",
    "- POTENTIAL_DUPLICATE: both reports most likely describe the same underlying issue/event.",
    "- RELATED: connected or similar topic, but clearly not the same instance (e.g. one broken lamp vs several broken lamps on the same road).",
    "- UNRELATED: different issues.",
    "- reason: one short sentence, user-safe, based only on the texts.",
    "- confidence: 0-1 confidence in the verdict.",
    'Reply with ONLY JSON: {"verdict":"POTENTIAL_DUPLICATE|RELATED|UNRELATED","confidence":0.85,"reason":"..."}',
  ].join("\n");
}

type Topic = "street_lighting" | "parking" | "road_damage" | "water_leak" | "waste" | "lost_pet" | "tree" | "signage" | "bus_shelter" | "electrical";

function reportTopic(text: string): Topic | null {
  const value = normalizeText(text);
  const rules: Array<[Topic, RegExp]> = [
    ["street_lighting", /\b(street ?lights?|street ?lamps?|streetlights?|lamp(?:s)? post|lamps?)\b/],
    ["parking", /\b(parking|parked|driveway|no parking)\b/],
    ["road_damage", /\b(pothole|road damage|road hole|broken road|cracked road|asphalt|road crack)\b/],
    ["water_leak", /\b(water leak|leaking pipe|burst pipe|broken pipe|pipe leak|water pipe|leakage)\b/],
    ["waste", /\b(trash|garbage|waste|rubbish|dumping|dumped|litter|overflowing bin)\b/],
    ["lost_pet", /\b(lost dog|missing dog|lost cat|missing cat|lost pet|missing pet|stray animal)\b/],
    ["tree", /\b(fallen tree|tree down|fallen branch|tree branch)\b/],
    ["signage", /\b(signage|public sign|street sign|road sign|broken sign)\b/],
    ["bus_shelter", /\b(bus shelter|bus stop shelter|bus stop glass)\b/],
    ["electrical", /\b(exposed wire|electrical hazard|electric wire|sparking wire|power cable)\b/],
  ];
  const matches = rules.filter(([, pattern]) => pattern.test(value)).map(([topic]) => topic);
  return matches.length === 1 ? matches[0] : null;
}

function reportAnchors(text: string): string[] {
  const value = normalizeText(text);
  const anchors = new Set<string>();
  for (const match of value.matchAll(/\b(block|building|intersection|junction|unit|lot|route)\s+([a-z0-9-]+)\b/g)) {
    anchors.add(`${match[1]} ${match[2]}`);
  }
  for (const match of value.matchAll(/\b\d{1,5}\b/g)) anchors.add(`number ${match[0]}`);
  for (const match of value.matchAll(/\b([a-z][a-z'-]+\s+(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|boulevard|blvd))\b/g)) {
    anchors.add(match[1]);
  }
  return [...anchors];
}

function hasScopeDifference(a: string, b: string): boolean {
  const broadScope = /\b(multiple|several|many|all|along the|entire|whole|row of)\b/;
  return broadScope.test(normalizeText(a)) !== broadScope.test(normalizeText(b));
}

/** High precision local decisions avoid unreliable model JSON for clear pairs. */
function compareDeterministically(
  a: ReportForComparison,
  b: ReportForComparison,
): Extract<DuplicateCompareResponse, { ok: true }> | null {
  const textA = normalizeText(`${a.title ?? ""} ${a.description}`);
  const textB = normalizeText(`${b.title ?? ""} ${b.description}`);
  if (textA === textB) {
    return { ok: true, verdict: "POTENTIAL_DUPLICATE", confidence: 0.99, reason: "The report descriptions are effectively identical." };
  }

  const topicA = reportTopic(textA);
  const topicB = reportTopic(textB);
  if (topicA && topicB && topicA !== topicB) {
    return { ok: true, verdict: "UNRELATED", confidence: 0.96, reason: "The reports describe different types of community issue." };
  }
  if (topicA && topicA === topicB) {
    const anchorsA = reportAnchors(textA);
    const anchorsB = reportAnchors(textB);
    const sharedAnchor = anchorsA.some((anchor) => anchorsB.includes(anchor));
    const scopeDiffers = hasScopeDifference(textA, textB);
    if (sharedAnchor && !scopeDiffers) {
      return { ok: true, verdict: "POTENTIAL_DUPLICATE", confidence: 0.86, reason: "Both reports describe the same issue type at the same named location." };
    }
    return {
      ok: true,
      verdict: "RELATED",
      confidence: sharedAnchor ? 0.78 : 0.68,
      reason: sharedAnchor
        ? "The reports concern the same issue type, but describe a different scale or scope."
        : "The reports concern the same issue type, but the text does not establish that they describe the same instance.",
    };
  }

  // No fixed topic match: an exact token overlap can safely identify a related
  // pair, but leave the finer distinction to OmniRoute.
  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));
  const overlap = [...tokensA].filter((token) => tokensB.has(token)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  if (union > 0 && overlap / union >= 0.8) {
    return { ok: true, verdict: "POTENTIAL_DUPLICATE", confidence: 0.82, reason: "The report wording and issue details are highly similar." };
  }
  return null;
}

/**
 * Semantic comparison of two reports. Returns ok:false (never a fabricated
 * verdict) when OmniRoute is unavailable or the response is unusable.
 */
export async function compareReportsForDuplicates(input: {
  reportA: ReportForComparison;
  reportB: ReportForComparison;
}): Promise<DuplicateCompareResponse> {
  const descriptionA = input.reportA.description.trim();
  const descriptionB = input.reportB.description.trim();
  if (!descriptionA || !descriptionB) {
    return { ok: false, error: "invalid_input", message: "Both reports need a description to compare." };
  }

  const deterministic = compareDeterministically(input.reportA, input.reportB);
  if (deterministic) {
    logIntel("Duplicates", "Deterministic comparison completed", { verdict: deterministic.verdict, confidence: deterministic.confidence });
    return deterministic;
  }

  logIntel("Duplicates", "Semantic comparison started");
  const response = await callOmniRouteChat({
    messages: [{ role: "user", content: buildComparePrompt(input.reportA, input.reportB) }],
    temperature: 0.1,
    maxTokens: 200,
    timeoutMs: REQUEST_SETTINGS.timeoutMs,
    responseFormat: "json_object",
  });
  if (!response.ok) {
    logIntel("Duplicates", "Semantic comparison unavailable", { error: response.error });
    return { ok: false, error: response.error, message: response.message };
  }

  const payload = extractJsonObject(response.text) as Record<string, unknown> | null;
  if (!payload) {
    return { ok: false, error: "invalid_response", message: "Comparison returned an unexpected response." };
  }

  const verdict = asEnum<DuplicateVerdict>(payload.verdict, VERDICT_VALUES);
  if (!verdict) {
    return { ok: false, error: "invalid_response", message: "Comparison returned an unexpected response." };
  }
  const confidence = asConfidence(payload.confidence) ?? 0.5;
  const reason = asString(payload.reason, 200) ?? "Compared the two report descriptions.";
  logIntel("Duplicates", "Semantic comparison completed", { verdict, confidence });
  return { ok: true, verdict, confidence, reason };
}
