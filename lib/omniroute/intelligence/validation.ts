/**
 * Validation of OmniRoute AI output.
 *
 * RULE: never trust AI JSON. Everything is parsed defensively and validated
 * into the Hivez-level types before it is used or returned. Malformed,
 * oversized, or out-of-enum output becomes null/empty - never a fabricated
 * success and never raw model text reaching the UI.
 */

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed.slice(start, end + 1));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function asString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

export function asStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const entry of value) {
    const item = asString(entry, maxLength);
    if (item) result.push(item);
    if (result.length >= maxItems) break;
  }
  return result;
}

export function asConfidence(value: unknown): number | null {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(num)) return null;
  const clamped = Math.min(1, Math.max(0, num));
  return Math.round(clamped * 100) / 100;
}

export function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase() as T;
  return allowed.includes(normalized) ? normalized : null;
}

export function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}
