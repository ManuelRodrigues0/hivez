/**
 * Frontend client for the OmniRoute Intelligence Gateway.
 *
 * React components call this service; it calls the server-side
 * /api/omniroute-intel route. The browser NEVER talks to OmniRoute directly
 * and never sees the OmniRoute API key, provider, or model.
 *
 * All calls fail gracefully: on any network/HTTP/intel failure we return
 * null-shaped results so existing Hivez features keep working when OmniRoute
 * is unavailable (§37) and we never fabricate an AI answer.
 */
import { COMMUNITIES } from "@/constants/communities";
import { REPORT_CATEGORIES } from "@/config/reportCategories";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase/firebase";

/** One searchable Hive entry (mirrors server HiveSnapshot; public data only). */
export interface HiveRegistryEntry {
  id: string;
  name: string;
  description: string;
  aliases?: string[];
  keywords?: string[];
  status: "provisional" | "emerging" | "established";
  reportCount?: number;
}

/** Deterministic search metadata (aliases/keywords) for the established Hives. */
export const HIVE_METADATA: Record<string, { aliases?: string[]; keywords?: string[] }> = {
  "lost-pets": {
    aliases: ["lost pet", "missing pet", "missing dog", "missing cat", "stray", "found pet"],
    keywords: ["missing", "lost", "dog", "cat", "animal"],
  },
  waste: {
    aliases: ["garbage", "trash", "rubbish", "refuse"],
    keywords: ["dumping", "dump", "bins", "overflowing bins", "litter", "cleanup", "waste disposal"],
  },
  "water-leakage": {
    aliases: ["water leak", "burst pipe", "pipe leak"],
    keywords: ["pipe", "leak", "leaking", "water", "drain", "pouring", "puddle", "tap"],
  },
  roads: {
    aliases: ["potholes", "broken road"],
    keywords: ["pothole", "hole", "road damage", "crack", "asphalt", "street damage", "uneven road"],
  },
  "street-lights": {
    aliases: ["street lamp", "streetlight", "street light"],
    keywords: ["light", "lamp", "dark", "lighting", "broken lamp", "lamp not working"],
  },
  "illegal-parking": {
    aliases: ["parking"],
    keywords: ["parked", "blocking", "blocked", "double parked", "no parking"],
  },
  "fallen-trees": {
    aliases: ["fallen tree", "tree down", "fallen branch"],
    keywords: ["tree", "branch", "blocked route", "hazard", "storm damage"],
  },
  "electric-hazards": {
    aliases: ["electrical hazard", "exposed wires", "damaged pole"],
    keywords: ["wire", "pole", "sparking", "electric", "cable"],
  },
  "blood-requests": {
    aliases: ["blood donation", "donate blood", "blood donor"],
    keywords: ["blood", "donor", "donation", "hospital", "emergency"],
  },
  "missing-persons": {
    aliases: ["missing person", "disappeared person"],
    keywords: ["missing", "person", "alert", "whereabouts"],
  },
};

/** Established hives come from the app constant; report categories enrich them. */
export function establishedHiveRegistry(): HiveRegistryEntry[] {
  const categoriesByCommunity = new Map<string, { title: string; description: string }[]>();
  for (const category of REPORT_CATEGORIES) {
    const list = categoriesByCommunity.get(category.communityId) ?? [];
    list.push({ title: category.title, description: category.description });
    categoriesByCommunity.set(category.communityId, list);
  }

  return COMMUNITIES.map((community) => {
    const metadata = HIVE_METADATA[community.id];
    const categories = categoriesByCommunity.get(community.id) ?? [];
    const categoryAliases = categories.map((category) => category.title.toLowerCase());
    const categoryDescription = categories.map((category) => category.description).join(" ");
    const alternateNames = metadata?.aliases ?? [];
    return {
      id: community.id,
      name: community.name,
      description: categoryDescription || community.description,
      aliases: Array.from(new Set([...alternateNames, ...categoryAliases])),
      keywords: metadata?.keywords ?? [],
      status: "established",
    };
  });
}

/**
 * Provisional/emerging hives stored in Firestore (the single authoritative
 * hive registry collection; rules allow signed-in access). Returns [] when the
 * collection does not exist yet or the read fails, so established hives always
 * keep searchable.
 */
export async function dynamicHiveRegistry(): Promise<HiveRegistryEntry[]> {
  try {
    const snapshot = await getDocs(collection(db, "hives"));
    const entries: HiveRegistryEntry[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (typeof data?.name !== "string" || !data.name.trim()) return;
      const status =
        data.status === "provisional" || data.status === "emerging" || data.status === "established"
          ? data.status
          : "provisional";
      entries.push({
        id: doc.id,
        name: String(data.name).trim(),
        description: typeof data.description === "string" ? data.description : "",
        aliases: Array.isArray(data.aliases) ? data.aliases.map(String) : undefined,
        keywords: Array.isArray(data.keywords) ? data.keywords.map(String) : undefined,
        status,
        reportCount: typeof data.reportCount === "number" ? data.reportCount : 0,
      });
    });
    return entries;
  } catch (error) {
    console.warn("[HiveSearch] Could not read dynamic hives:", error instanceof Error ? error.message : "unknown");
    return [];
  }
}

/** Full searchable registry: established constants + Firestore hives. */
export async function buildHiveRegistry(): Promise<HiveRegistryEntry[]> {
  const [established, dynamic] = await Promise.all([Promise.resolve(establishedHiveRegistry()), dynamicHiveRegistry()]);
  return [...established, ...dynamic];
}
// ---------------------------------------------------------------------------
// Gateway request helpers
// ---------------------------------------------------------------------------

async function postIntel<T>(op: string, payload: unknown, signal?: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch("/api/omniroute-intel", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op, payload }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as T & { ok?: boolean };
    if (!data || data.ok === false) return null;
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return null;
    console.warn("[OmniRoute] Intelligence request failed:", error instanceof Error ? error.message : "unknown");
    return null;
  }
}

/** Semantic Hive search (server does deterministic-first; only weak queries use OmniRoute). */
export async function intelSearchHives(
  query: string,
  registry: HiveRegistryEntry[],
  signal?: AbortSignal,
): Promise<{ matches: Array<{ hiveId: string; confidence: number; reason: string; matchType: string }>; queryConcepts: string[] } | null> {
  const result = await postIntel<{
    ok: true;
    matches: Array<{ hiveId: string; confidence: number; reason: string; matchType: string }>;
    queryConcepts: string[];
  }>("searchHives", { query, registry }, signal);
  return result ?? null;
}

/** New-issue analysis: existing-hive check, meaningfulness, consistency, proposal. */
export async function intelAnalyzeIssue(input: {
  description: string;
  imageDataUrl?: string | null;
  registry: HiveRegistryEntry[];
}): Promise<{
  meaningfulness: string;
  descriptionImageMatch: boolean | null;
  consistencyNote: string | null;
  existingHiveId: string | null;
  existingHiveConfidence: number | null;
  proposal: { name: string; description: string; aliases: string[]; keywords: string[] } | null;
} | null> {
  return postIntel(
    "analyzeIssue",
    {
      description: input.description.slice(0, 2000),
      imageDataUrl: input.imageDataUrl ?? null,
      registry: input.registry,
    },
  );
}

/** Optional description improvement suggestion (never modifies user text). */
export async function intelAssistDescription(description: string): Promise<{
  suggestion: string | null;
  completenessHints: string[];
} | null> {
  return postIntel("assistDescription", { description: description.slice(0, 2000) });
}

/** Semantic duplicate/related comparison between two reports. */
export async function intelCompareDuplicates(reportA: string, reportB: string): Promise<{
  verdict: string;
  confidence: number;
  reason: string;
} | null> {
  return postIntel("compareReportsForDuplicates", {
    reportA: { description: reportA.slice(0, 1500) },
    reportB: { description: reportB.slice(0, 1500) },
  });
}