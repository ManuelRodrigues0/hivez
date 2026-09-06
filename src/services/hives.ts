/**
 * Hivez-side persistence for the central Hive registry.
 *
 * OmniRoute may PROPOSE a hive (name/description/aliases/keywords), but only
 * this validated data layer may CREATE it. Validation rules mirror the app's
 * conventions: non-empty name, reasonable length, safe characters, no obvious
 * duplicate canonical hive, sanitized aliases/keywords, valid lifecycle status.
 * Raw AI output never becomes a database entity without passing through here.
 */
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { COMMUNITIES } from "@/constants/communities";
import { REPORT_CATEGORIES, type ReportCategoryConfig } from "@/config/reportCategories";
import { buildHiveRegistry, type HiveRegistryEntry } from "@/services/omnirouteIntel";

/** Lifecycle promotion thresholds mirror the server config (single source of truth). */
export const HIVE_LIFECYCLE = {
  provisionalToEmergingReports: 3,
  emergingToEstablishedReports: 10,
} as const;

export interface NewHiveInput {
  name: string;
  description: string;
  aliases?: string[];
  keywords?: string[];
}

export interface ValidatedHive {
  name: string;
  description: string;
  aliases: string[];
  keywords: string[];
  status: "provisional";
}

/** Returns a cleaned name or null when invalid. */
function cleanHiveName(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 3 || trimmed.length > 60) return null;
  // Safe characters only: letters, numbers, spaces, common punctuation.
  if (!/^[\p{L}\p{N} &'(),./\-–—]{3,60}$/u.test(trimmed)) return null;
  return trimmed;
}

/** Returns a cleaned description or null when invalid. */
function cleanHiveDescription(description: string): string | null {
  const trimmed = description.trim().replace(/\s+/g, " ");
  if (trimmed.length < 10 || trimmed.length > 300) return null;
  return trimmed;
}

function cleanList(values: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const item = value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, maxLength);
    if (!item || item.length < 2) continue;
    if (!/^[\p{L}\p{N} &'\-,]+$/u.test(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    cleaned.push(item);
    if (cleaned.length >= maxItems) break;
  }
  return cleaned;
}

/**
 * Validates a proposed hive against the current registry and the hardcoded
 * established hives/categories. Returns a validated hive doc payload or an
 * error message. Never trusts the proposer blindly.
 */
export function validateHiveProposal(input: NewHiveInput, existing: HiveRegistryEntry[]): { ok: true; hive: ValidatedHive } | { ok: false; error: string } {
  const name = cleanHiveName(input.name);
  if (!name) return { ok: false, error: "Hive name must be 3–60 safe characters." };

  const description = cleanHiveDescription(input.description);
  if (!description) return { ok: false, error: "Hive description must be 10–300 characters." };

  const normalized = name.toLowerCase();
  const duplicates = [
    ...existing,
    ...COMMUNITIES.map((c) => ({ id: c.id, name: c.name, description: c.description, aliases: undefined as string[] | undefined, keywords: undefined as string[] | undefined, status: "established" as const })),
    ...REPORT_CATEGORIES.map((c) => ({ id: c.id, name: c.title, description: c.description, aliases: undefined as string[] | undefined, keywords: undefined as string[] | undefined, status: "established" as const })),
  ];
  const canonical = duplicates.find((hive) => hive.name.toLowerCase() === normalized);
  if (canonical) return { ok: false, error: `A hive named "${canonical.name}" already exists.` };

  // Duplicate-concept guard: reject names that strongly overlap an existing
  // hive's name/aliases/keywords (e.g. "Trash Dumping" vs "Waste & Garbage").
  const nameTokens = normalized.split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  if (nameTokens.length > 0) {
    for (const hive of duplicates) {
      const haystack = `${hive.name} ${(hive.aliases ?? []).join(" ")} ${(hive.keywords ?? []).join(" ")}`.toLowerCase();
      const overlap = nameTokens.filter((token) => haystack.includes(token)).length;
      if (overlap / nameTokens.length >= 0.5) {
        return { ok: false, error: `A similar hive already exists: "${hive.name}". Search for it instead.` };
      }
    }
  }

  const aliases = cleanList(input.aliases, 8, 40);
  if (aliases.includes(normalized)) return { ok: false, error: "An alias cannot duplicate the hive name." };

  return {
    ok: true,
    hive: {
      name,
      description,
      aliases,
      keywords: cleanList(input.keywords, 10, 30),
      status: "provisional",
    },
  };
}

/**
 * Persists a validated provisional hive. Returns the new hive id, or throws —
 * callers should catch and treat as non-fatal (the report can continue via an
 * existing category).
 */
export async function createProvisionalHive(input: NewHiveInput, createdBy: string): Promise<{ id: string }> {
  const existing = await buildHiveRegistry();
  const validated = validateHiveProposal(input, existing);
  if (!validated.ok) throw new Error(validated.error);

  const docRef = await addDoc(collection(db, "hives"), {
    name: validated.hive.name,
    description: validated.hive.description,
    aliases: validated.hive.aliases,
    keywords: validated.hive.keywords,
    status: validated.hive.status,
    reportCount: 0,
    createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id };
}

/** User-safe label for the subtle lifecycle status shown in the UI. */
export function hiveStatusLabel(status: HiveRegistryEntry["status"]): string {
  if (status === "provisional") return "New";
  if (status === "emerging") return "Emerging";
  return "";
}

/** The next lifecycle status after enough reports (configurable thresholds). */
export function nextHiveStatus(current: HiveRegistryEntry["status"], reportCount: number): HiveRegistryEntry["status"] | null {
  if (current === "provisional" && reportCount >= HIVE_LIFECYCLE.provisionalToEmergingReports) return "emerging";
  if (current === "emerging" && reportCount >= HIVE_LIFECYCLE.emergingToEstablishedReports) return "established";
  return null;
}

/** Best-matching report category for a hive id (first category of that hive). */
export function categoryForHive(hiveId: string) {
  return REPORT_CATEGORIES.find((category) => category.communityId === hiveId) ?? null;
}

/**
 * Returns a category for a hive, synthesizing a minimal category for dynamic
 * (provisional/emerging) hives so they plug into the existing category-driven
 * report flow without a code change or a hardcoded list.
 */
export function categoryFromHive(hive: HiveRegistryEntry): ReportCategoryConfig {
  const existing = categoryForHive(hive.id);
  if (existing) return existing;
  return {
    id: `hive-${hive.id}`,
    title: hive.name,
    communityId: hive.id,
    description: hive.description,
    icon: "CircleHelp",
    cameraAllowed: true,
    galleryAllowed: true,
    videoAllowed: true,
    requiresMedia: false,
    verificationModel: null,
    mediaTitle: "Add evidence",
    mediaHelp: "Add a photo or video if it helps others understand the issue.",
    cameraLabel: "Open Camera",
    galleryLabel: "Choose from Gallery",
    videoLabel: "Upload Video",
    verification: { highConfidence: 0.9, mediumConfidence: 0.7, geminiMode: "disabled", geminiInstructions: "" },
    fields: [{ id: "issueDetails", label: "Describe the issue.", placeholder: "What is happening?" }],
  };
}

/** True when the selected report category represents a dynamic hive (or "Other"). */
export function isNewIssueCategory(categoryId: string): boolean {
  return categoryId === "other" || categoryId.startsWith("hive-");
}