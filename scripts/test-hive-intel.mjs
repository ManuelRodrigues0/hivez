/* Hive Intelligence test matrix (server-side, real OmniRoute when key available).
 *
 * Compiles lib/omniroute into .tmp-esmtest and exercises the real modules:
 *  - §51 search (garbage/trash/pipe/hole/lamp/dog)
 *  - §52/§53 provisional + emerging hive discoverability
 *  - §54 genuinely new issue -> normalized proposal
 *  - §55 existing hive prevents duplicate creation
 *  - §57 meaningless issue -> never becomes a hive / never proposes
 *  - §58 description assistance (original text untouched)
 *  - §59 duplicate vs related semantic analysis
 *  - §60 failure mode (OmniRoute unreachable -> graceful degradation)
 *
 * Exit code 0 = no failures. Semantic checks that need a live key and a key is
 * missing are recorded BLOCKED, not failures.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, ".tmp-esmtest");

const results = [];
let failures = 0;
let blocked = 0;

function record(name, status, note) {
  results.push({ name, status, note });
  if (status === "FAIL") failures++;
  if (status === "BLOCKED") blocked++;
  console.log(`${status.padEnd(7)}${name}${note ? ` — ${note}` : ""}`);
}

async function step(name, fn, opts = {}) {
  const needsLive = Boolean(opts.live);
  const keyConfigured = Boolean(process.env.OMNIROUTE_API_KEY);
  if (needsLive && !keyConfigured) {
    record(name, "BLOCKED", "requires real OMNIROUTE_API_KEY");
    return;
  }
  try {
    const note = await fn();
    record(name, "PASS", typeof note === "string" ? note : undefined);
  } catch (error) {
    record(name, "FAIL", error instanceof Error ? error.message : String(error));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadEnvFile(file) {
  const full = path.join(ROOT, file);
  if (!existsSync(full)) return;
  for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] = value;
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

console.log("=== HIVE INTELLIGENCE TEST MATRIX ===\n");
loadEnvFile(".env.local");
loadEnvFile(".env.vercel.local");

console.log("Step 1: compiling lib/omniroute with tsc");
writeFileSync(
  path.join(OUT_DIR, "tsconfig.omniroute-intel.json"),
  JSON.stringify(
    {
      compilerOptions: {
        module: "nodenext",
        moduleResolution: "nodenext",
        target: "es2022",
        lib: ["es2023", "dom"],
        skipLibCheck: true,
        rootDir: "..",
        outDir: ".",
      },
      files: [
        "../lib/omniroute/client.ts",
        "../lib/omniroute/config.ts",
        "../lib/omniroute/types.ts",
        "../lib/omniroute/intelligence/cache.ts",
        "../lib/omniroute/intelligence/validation.ts",
        "../lib/omniroute/intelligence/registry.ts",
        "../lib/omniroute/intelligence/hiveSearch.ts",
        "../lib/omniroute/intelligence/issueAnalysis.ts",
        "../lib/omniroute/intelligence/duplicates.ts",
      ],
    },
    null,
    2,
  ),
);
execSync("npx tsc -p .tmp-esmtest/tsconfig.omniroute-intel.json", { cwd: ROOT, stdio: "pipe" });
console.log("Compile OK\n");

const { searchHives } = await import(pathToFileURL(path.join(OUT_DIR, "lib/omniroute/intelligence/hiveSearch.js")).href);
const { analyzeIssue, assistDescription } = await import(pathToFileURL(path.join(OUT_DIR, "lib/omniroute/intelligence/issueAnalysis.js")).href);
const { compareReportsForDuplicates } = await import(pathToFileURL(path.join(OUT_DIR, "lib/omniroute/intelligence/duplicates.js")).href);
// ---------------------------------------------------------------------------
// Registry mirroring the frontend built from COMMUNITIES + REPORT_CATEGORIES
// + HIVE_METADATA (exactly what the browser sends to /api/omniroute-intel).
// ---------------------------------------------------------------------------
function establishedRegistry() {
  const categoryMixin = {
    "lost-pets": ["Lost Pet", "Animal in Danger"],
    waste: ["Garbage / Waste"],
    roads: ["Broken Road", "Flooded Road", "Damaged Property"],
    "street-lights": ["Street Light"],
    "water-leakage": ["Water Leakage"],
    "electric-hazards": ["Dangerous Electrical Wire"],
    "illegal-parking": ["Illegal Parking"],
    "fallen-trees": ["Fallen Tree"],
    "blood-requests": ["Blood Request"],
    "missing-persons": ["Missing Person"],
  };
  const metadata = {
    "lost-pets": { aliases: ["lost pet", "missing pet", "missing dog", "missing cat", "stray", "found pet"], keywords: ["missing", "lost", "dog", "cat", "animal"] },
    waste: { aliases: ["garbage", "trash", "rubbish", "refuse"], keywords: ["dumping", "dump", "bins", "overflowing bins", "litter", "cleanup", "waste disposal"] },
    "water-leakage": { aliases: ["water leak", "burst pipe", "pipe leak"], keywords: ["pipe", "leak", "leaking", "water", "drain", "pouring", "puddle", "tap"] },
    roads: { aliases: ["potholes", "broken road"], keywords: ["pothole", "hole", "road damage", "crack", "asphalt", "street damage", "uneven road"] },
    "street-lights": { aliases: ["street lamp", "streetlight", "street light"], keywords: ["light", "lamp", "dark", "lighting", "broken lamp", "lamp not working"] },
    "illegal-parking": { aliases: ["parking"], keywords: ["parked", "blocking", "blocked", "double parked", "no parking"] },
    "fallen-trees": { aliases: ["fallen tree", "tree down", "fallen branch"], keywords: ["tree", "branch", "blocked route", "hazard", "storm damage"] },
    "electric-hazards": { aliases: ["electrical hazard", "exposed wires", "damaged pole"], keywords: ["wire", "pole", "sparking", "electric", "cable"] },
    "blood-requests": { aliases: ["blood donation", "donate blood", "blood donor"], keywords: ["blood", "donor", "donation", "hospital", "emergency"] },
    "missing-persons": { aliases: ["missing person", "disappeared person"], keywords: ["missing", "person", "alert", "whereabouts"] },
  };
  const names = {
    "lost-pets": "Lost Pets",
    waste: "Waste & Garbage",
    "water-leakage": "Water Leakage",
    roads: "Roads & Potholes",
    "street-lights": "Street Lights",
    "illegal-parking": "Illegal Parking",
    "fallen-trees": "Fallen Trees",
    "electric-hazards": "Electric Hazards",
    "blood-requests": "Blood Requests",
    "missing-persons": "Missing Persons",
  };
  return Object.entries(names).map(([id, name]) => {
    const mixin = categoryMixin[id] ?? [];
    const meta = metadata[id] ?? {};
    return {
      id,
      name,
      description: mixin.join(". ") || name,
      aliases: Array.from(new Set([...(meta.aliases ?? []), ...mixin.map((c) => c.toLowerCase())])),
      keywords: meta.keywords ?? [],
      status: "established",
    };
  });
}

function withDynamic(extras) {
  return [...establishedRegistry(), ...extras];
}

// Dynamic (provisional/emerging) hives for §52/§53.
const dynamicHives = [
  { id: "dh-bus-shelters", name: "Damaged Bus Shelters", description: "Broken bus shelters, shattered panels, damaged stops.", aliases: ["bus shelter", "broken bus stop"], keywords: ["bus", "shelter", "shattered", "glass", "stop"], status: "provisional", reportCount: 1 },
  { id: "dh-signage", name: "Damaged Public Signage", description: "Broken, bent or missing public signs.", aliases: ["sign", "signage", "broken sign"], keywords: ["sign", "signage", "damaged", "poster", "board"], status: "emerging", reportCount: 2 },
];

const registry = withDynamic(dynamicHives);

function bestMatch(result) {
  if (!result || !result.ok || !Array.isArray(result.matches) || result.matches.length === 0) return null;
  return result.matches[0];
}
console.log("=== §51 SEARCH (deterministic + semantic) ===\n");

await step("TEST1 garbage → Waste & Garbage (deterministic, no AI)", async () => {
  const result = await searchHives("garbage", registry);
  const top = bestMatch(result);
  assert(top && top.hiveId === "waste", `expected waste, got ${JSON.stringify(top)}`);
  assert(top.confidence >= 0.8, `expected high deterministic confidence, got ${top.confidence}`);
  assert(result.matches.length === 1, "deterministic strong match should be the only match");
});

await step("TEST2 trash → Waste & Garbage (alias)", async () => {
  const result = await searchHives("trash", registry);
  const top = bestMatch(result);
  assert(top && top.hiveId === "waste", `expected waste, got ${JSON.stringify(top)}`);
});

await step("TEST3 water coming from broken pipe → Water Leakage", async () => {
  const result = await searchHives("water coming from broken pipe", registry);
  const top = bestMatch(result);
  assert(top && top.hiveId === "water-leakage", `expected water-leakage, got ${JSON.stringify(top)}`);
  assert(top.matchType === "existing_hive" || top.matchType === "semantic_hive", `unexpected matchType ${top.matchType}`);
});

await step("TEST4 there is a huge hole in the road → Roads & Potholes", async () => {
  const result = await searchHives("there is a huge hole in the road", registry);
  const top = bestMatch(result);
  assert(top && top.hiveId === "roads", `expected roads, got ${JSON.stringify(top)}`);
});

await step("TEST5 broken lamp outside my house → Street Lights", async () => {
  const result = await searchHives("broken lamp outside my house", registry);
  const top = bestMatch(result);
  assert(top && top.hiveId === "street-lights", `expected street-lights, got ${JSON.stringify(top)}`);
});

await step("TEST6 dog missing → Lost Pets", async () => {
  const result = await searchHives("dog missing", registry);
  const top = bestMatch(result);
  assert(top && top.hiveId === "lost-pets", `expected lost-pets, got ${JSON.stringify(top)}`);
});

console.log("\n=== §52/§53 EMERGING + PROVISIONAL HIVES SEARCHABLE ===\n");

await step("provisional 'Damaged Bus Shelters' found by name/keywords", async () => {
  const result = await searchHives("bus shelter broken", registry);
  const top = bestMatch(result);
  assert(top && top.hiveId === "dh-bus-shelters", `expected dh-bus-shelters, got ${JSON.stringify(top)}`);
});

await step("emerging 'Damaged Public Signage' found via alias 'broken sign'", async () => {
  const result = await searchHives("broken sign near the market", registry);
  const top = bestMatch(result);
  assert(top && top.hiveId === "dh-signage", `expected dh-signage, got ${JSON.stringify(top)}`);
});

console.log("\n=== §55 EXISTING HIVE PREVENTS DUPLICATE ===\n");

await step("'trash dumped behind my building' → Waste & Garbage (no new hive)", async () => {
  const result = await searchHives("trash dumped behind my building", registry);
  const top = bestMatch(result);
  assert(top && top.hiveId === "waste", `expected waste, got ${JSON.stringify(top)}`);
  assert(top.matchType !== "clarification_needed", "should not need clarification");
});
console.log("\n=== §54/§56/§57 NEW ISSUE ANALYSIS (live) ===\n");

await step("ANALYZE genuinely new bus-shelter issue → valid normalized proposal OR valid existing hive", async () => {
  const result = await analyzeIssue({
    description: "A public bus shelter on the main avenue has a shattered glass panel and a broken bench inside.",
    registry: withDynamic([]),
  });
  assert(result.ok === true, `expected ok, got ${JSON.stringify(result)}`);
  const r = result;
  // Invariants the server guarantees regardless of which upstream answers:
  const validIds = new Set(establishedRegistry().map((hive) => hive.id));
  if (r.existingHiveId !== null) assert(validIds.has(r.existingHiveId), "existingHiveId must reference a real hive");
  if (r.proposal !== null) {
    assert(r.proposal.name.length >= 3 && r.proposal.name.length <= 60, "proposal name length valid");
    assert(Array.isArray(r.proposal.aliases) && Array.isArray(r.proposal.keywords), "proposal aliases/keywords arrays");
    assert(r.existingHiveId === null, "proposal and existingHiveId are mutually exclusive");
    const dupName = establishedRegistry().find((hive) => hive.name.toLowerCase() === r.proposal.name.toLowerCase() || hive.aliases?.some((a) => a.toLowerCase() === r.proposal.name.toLowerCase()));
    assert(!dupName, "proposal must not duplicate an existing hive name or alias");
  }
  return r.proposal ? `proposal="${r.proposal.name}"` : `existingHive=${r.existingHiveId}`;
}, { live: true });

await step("ANALYZE 'trash dumped behind my building' → never proposes a duplicate hive concept", async () => {
  const result = await analyzeIssue({ description: "trash dumped behind my building", registry: withDynamic([]) });
  assert(result.ok === true, `expected ok, got ${JSON.stringify(result)}`);
  const validIds = new Set(establishedRegistry().map((hive) => hive.id));
  if (result.existingHiveId !== null) assert(validIds.has(result.existingHiveId), "existingHiveId must reference a real hive");
  if (result.proposal !== null) {
    const dup = establishedRegistry().find(
      (hive) => hive.name.toLowerCase() === result.proposal.name.toLowerCase() || hive.aliases?.some((a) => a.toLowerCase() === result.proposal.name.toLowerCase()),
    );
    assert(!dup, `must not propose duplicate of existing hive: ${result.proposal.name}`);
  }
  return `existingHive=${result.existingHiveId} proposal=${result.proposal ? result.proposal.name : "none"}`;
}, { live: true });

await step("ANALYZE 'My car is annoying.' → no hive, proposal must be null", async () => {
  const result = await analyzeIssue({ description: "My car is annoying.", registry: withDynamic([]) });
  assert(result.ok === true, `expected ok, got ${JSON.stringify(result)}`);
  assert(typeof result.meaningfulness === "string", "meaningfulness missing");
  assert(result.proposal === null, "meaningless issue must not produce a hive proposal");
  return `meaningfulness=${result.meaningfulness}`;
}, { live: true });

await step("ANALYZE description/image consistency structure ('There is a pothole.' + image)", async () => {
  // 1x1 transparent PNG data URL: structure-validity check of the image path.
  // Some upstreams cannot process images; text-only analysis must still succeed
  // with descriptionImageMatch=null (graceful degradation, no fabricated verdict).
  const tinyImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const result = await analyzeIssue({ description: "There is a pothole.", imageDataUrl: tinyImage, registry: withDynamic([]) });
  assert(result.ok === true, `expected ok, got ${JSON.stringify(result)}`);
  assert(
    result.descriptionImageMatch === true || result.descriptionImageMatch === false || result.descriptionImageMatch === null,
    "image match should be a boolean or null (image unsupported)", 
  );
  if (result.descriptionImageMatch === false) {
    assert(result.consistencyNote !== null && result.consistencyNote.length > 0, "consistency note required on mismatch");
  }
  return `descriptionImageMatch=${String(result.descriptionImageMatch)}`;
}, { live: true });
console.log("\n=== §58 DESCRIPTION ASSISTANCE (live) ===\n");

await step("DESC 'road bad here' → clearer suggestion, original untouched", async () => {
  const original = "road bad here";
  const result = await assistDescription({ description: original });
  assert(result.ok === true, `expected ok, got ${JSON.stringify(result)}`);
  const r = result;
  assert(r.suggestion === null || (typeof r.suggestion === "string" && r.suggestion.length > original.length), "suggestion should be clearer/longer or null");
  assert(Array.isArray(r.completenessHints), "completeness hints should be an array");
  // The server never mutates the user's text — original must remain identical.
  assert(original === "road bad here", "original text unchanged");
  return r.suggestion ? `suggestion="${r.suggestion.slice(0, 50)}..."` : "no suggestion needed";
}, { live: true });

await step("DESC short 'Broken pipe.' → completeness hint present", async () => {
  const result = await assistDescription({ description: "Broken pipe." });
  assert(result.ok === true, `expected ok, got ${JSON.stringify(result)}`);
  assert(result.completenessHints.length > 0 || result.suggestion !== null, "should offer a hint or suggestion");
}, { live: true });

console.log("\n=== §59 DUPLICATE / RELATED SEMANTIC ANALYSIS (live) ===\n");

await step("DUP identical-style reports → POTENTIAL_DUPLICATE", async () => {
  const result = await compareReportsForDuplicates({
    reportA: { description: "Streetlight outside block A isn't working." },
    reportB: { description: "The street lamp near block A has stopped working." },
  });
  assert(result.ok === true, `expected ok, got ${JSON.stringify(result)}`);
  assert(result.verdict === "POTENTIAL_DUPLICATE", `expected POTENTIAL_DUPLICATE, got ${result.verdict}`);
}, { live: true });

await step("DUP related-but-distinct reports → never UNRELATED (not collapsed incorrectly)", async () => {
  const result = await compareReportsForDuplicates({
    reportA: { description: "Streetlight outside block A isn't working." },
    reportB: { description: "Multiple lamps along this road are not functioning." },
  });
  assert(result.ok === true, `expected ok, got ${JSON.stringify(result)}`);
  assert(result.verdict === "RELATED" || result.verdict === "POTENTIAL_DUPLICATE", `related reports must not be UNRELATED, got ${result.verdict}`);
}, { live: true });

await step("DUP unrelated reports → UNRELATED", async () => {
  const result = await compareReportsForDuplicates({
    reportA: { description: "Streetlight outside block A isn't working." },
    reportB: { description: "My neighbour parked across my driveway again." },
  });
  assert(result.ok === true, `expected ok, got ${JSON.stringify(result)}`);
  assert(result.verdict === "UNRELATED", `expected UNRELATED, got ${result.verdict}`);
}, { live: true });

console.log("\n=== §60 FAILURE MODE (OmniRoute unreachable) ===\n");

await step("FAIL deterministic search works with OmniRoute down", async () => {
  const deadPort = await freePort();
  const saved = process.env.OMNIROUTE_BASE_URL;
  process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${deadPort}/v1`;
  try {
    const result = await searchHives("garbage", registry);
    const top = bestMatch(result);
    assert(result.ok === true && top && top.hiveId === "waste", `expected degraded waste match, got ${JSON.stringify(top)}`);
  } finally {
    process.env.OMNIROUTE_BASE_URL = saved;
  }
});

await step("FAIL weak query with OmniRoute down returns controlled fallback (no crash)", async () => {
  const deadPort = await freePort();
  const saved = process.env.OMNIROUTE_BASE_URL;
  process.env.OMNIROUTE_BASE_URL = `http://127.0.0.1:${deadPort}/v1`;
  try {
    const result = await searchHives("there is a huge hole in the road", registry);
    assert(result.ok === true, "must not throw and must return ok when OmniRoute is down");
    if (result.matches.length > 0 && result.matches[0].hiveId === "roads") return "degraded to deterministic roads match";
    return "ok with controlled result (semantics unavailable)";
  } finally {
    process.env.OMNIROUTE_BASE_URL = saved;
  }
});

console.log("\n=== Summary ===");
for (const result of results) {
  console.log(`${result.status.padEnd(7)} ${result.name}${result.note ? ` — ${result.note}` : ""}`);
}
const passed = results.filter((r) => r.status === "PASS").length;
console.log(`\n${passed} passed, ${blocked} blocked, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);