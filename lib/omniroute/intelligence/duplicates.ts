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

  logIntel("Duplicates", "Semantic comparison started");
  const response = await callOmniRouteChat({
    messages: [{ role: "user", content: buildComparePrompt(input.reportA, input.reportB) }],
    temperature: 0.1,
    maxTokens: 200,
    timeoutMs: REQUEST_SETTINGS.timeoutMs,
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
