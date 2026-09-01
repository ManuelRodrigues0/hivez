declare const process: { env: Record<string, string | undefined> };

import type { NormalizedProviderResult } from "./types.js";

export const MAX_BASE64_LENGTH = 3_800_000;

/**
 * What "issueDetected" means for a category.
 * - "issue_visible": the actual physical issue/hazard/damage is visibly present.
 * - "subject_visible": the expected subject is visibly present (the image cannot
 *   prove the real-world situation, e.g. that an animal is actually lost).
 */
export type CategoryVerificationMode = "issue_visible" | "subject_visible";

export interface CategoryVerificationContext {
  id: string;
  title: string;
  description: string;
  expectedObjects: string[];
  prompt: string;
  verificationMode: CategoryVerificationMode;
}

export interface ProviderConfig {
  provider: string;
  providerGroup: string;
  model: string;
  /** Human-readable name used in verification logs (e.g. "Groq Qwen 3.6 27B"). */
  label?: string;
  envKey?: string;
  envKeys?: string[];
  enabled: boolean;
  supportsImage: boolean;
  endpoint: "gemini" | "xai" | "nvidia" | "openrouter" | "groq";
  batch: number;
}

export const verificationThresholds = {
  providerTimeoutMs: 20_000,
  initialCloudBatchSize: 2,
  minCloudChecksForEarlyConsensus: 2,
  minIndependentGroupsForEarlyConsensus: 3,
  cloudStrongConfidence: 0.72,
  localStrongConfidence: 0.8,
  finalVerifiedAgreement: 0.66,
  finalRejectedAgreement: 0.66,
  minimumSuccessfulCloudChecks: 1,
  poorQualityBlocksEarlyStop: true,
};

export const categoryContexts: Record<string, CategoryVerificationContext> = {
  lost_pet: {
    id: "lost_pet",
    title: "Lost Pet",
    description: "Report a missing or lost animal",
    expectedObjects: ["animal", "pet", "dog", "cat", "bird"],
    verificationMode: "subject_visible",
    prompt: "Determine whether the image visibly contains a relevant animal. Do not determine whether the animal is actually lost.",
  },
  missing_person: {
    id: "missing_person",
    title: "Missing Person",
    description: "Share a missing person alert without facial recognition",
    expectedObjects: ["person", "people", "reference photo of a person"],
    verificationMode: "subject_visible",
    prompt: "Assess only whether the image is usable and a relevant person reference is visible. Do not identify or verify the identity of any person. Do not determine whether the person is actually missing.",
  },
  garbage: {
    id: "garbage",
    title: "Garbage / Waste",
    description: "Overflowing bins, dumping, or waste hazards",
    expectedObjects: ["garbage", "trash", "waste", "overflowing bin", "dumping"],
    verificationMode: "issue_visible",
    prompt: "Determine whether visible garbage or waste is present.",
  },
  broken_road: {
    id: "broken_road",
    title: "Broken Road",
    description: "Potholes, cracks, or unsafe road damage",
    expectedObjects: ["pothole", "road crack", "damaged road", "unsafe road"],
    verificationMode: "issue_visible",
    prompt: "Determine whether potholes, cracks, or relevant road damage are visible.",
  },
  street_light: {
    id: "street_light",
    title: "Street Light",
    description: "Broken lights, dark roads, or unsafe lighting",
    expectedObjects: ["street light", "light pole", "lamp post", "broken light"],
    verificationMode: "issue_visible",
    prompt: "Determine whether a street light is visible and whether obvious damage or lighting issue evidence is visible.",
  },
  water_leakage: {
    id: "water_leakage",
    title: "Water Leakage",
    description: "Leaks, burst pipes, or water waste",
    expectedObjects: ["water leak", "burst pipe", "leaking infrastructure", "water flow"],
    verificationMode: "issue_visible",
    prompt: "Determine whether visible water leakage from relevant infrastructure is present.",
  },
  electrical: {
    id: "electrical",
    title: "Dangerous Electrical Wire",
    description: "Exposed wires, damaged poles, or electrical risk",
    expectedObjects: ["wire", "electrical pole", "exposed cable", "fallen wire"],
    verificationMode: "issue_visible",
    prompt: "Determine whether potentially dangerous exposed or fallen electrical infrastructure is visually present. Do not make definitive safety or legal claims.",
  },
  illegal_parking: {
    id: "illegal_parking",
    title: "Illegal Parking",
    description: "Blocked roads, gates, or unsafe parking",
    expectedObjects: ["vehicle", "blocked road", "blocked sidewalk", "parking obstruction"],
    verificationMode: "issue_visible",
    prompt: "Determine whether the image visually shows a vehicle blocking a road, gate, or sidewalk where applicable. Do not make definitive legal conclusions.",
  },
  fallen_tree: {
    id: "fallen_tree",
    title: "Fallen Tree",
    description: "Fallen trees or branches blocking access",
    expectedObjects: ["fallen tree", "fallen branch", "blocked road", "tree debris"],
    verificationMode: "issue_visible",
    prompt: "Determine whether a fallen tree or fallen branch is visibly present.",
  },
  flooded_road: {
    id: "flooded_road",
    title: "Flooded Road",
    description: "Waterlogged roads or flooding",
    expectedObjects: ["flooding", "waterlogged road", "standing water", "flooded street"],
    verificationMode: "issue_visible",
    prompt: "Determine whether flooding or significant waterlogging is visibly present.",
  },
  animal_in_danger: {
    id: "animal_in_danger",
    title: "Animal in Danger",
    description: "Injured, trapped, or unsafe animals",
    expectedObjects: ["animal", "injured animal", "trapped animal", "animal danger"],
    verificationMode: "issue_visible",
    prompt: "Determine whether an animal and visually observable signs of a potentially dangerous situation are present. Do not make unsupported medical claims.",
  },
  damaged_property: {
    id: "damaged_property",
    title: "Damaged Property",
    description: "Public or shared property damage",
    expectedObjects: ["broken property", "damaged public asset", "cracked wall", "broken sign"],
    verificationMode: "issue_visible",
    prompt: "Determine whether visually observable property damage is present.",
  },
};

export const providerConfigs: ProviderConfig[] = [
  {
    provider: "gemini",
    providerGroup: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
    label: "Gemini",
    envKey: "GEMINI_API_KEY",
    enabled: process.env.GEMINI_VERIFICATION_ENABLED !== "false",
    supportsImage: true,
    endpoint: "gemini",
    batch: 1,
  },
  {
    provider: "grok",
    providerGroup: "xai",
    model: process.env.XAI_MODEL || "grok-4.6",
    label: "xAI Grok",
    envKey: "XAI_API_KEY",
    enabled: process.env.XAI_VERIFICATION_ENABLED !== "false",
    supportsImage: true,
    endpoint: "xai",
    batch: 1,
  },
  {
    provider: "nvidia-nemotron-ultra",
    providerGroup: "nvidia",
    model: process.env.NVIDIA_NEMOTRON_ULTRA_MODEL || "nvidia/nemotron-3-ultra",
    label: "NVIDIA Nemotron Ultra",
    envKey: "NVIDIA_API_KEY",
    enabled: process.env.NVIDIA_NEMOTRON_ULTRA_ENABLED !== "false",
    supportsImage: process.env.NVIDIA_NEMOTRON_ULTRA_VISION_ENABLED === "true",
    endpoint: "nvidia",
    batch: 2,
  },
  {
    provider: "nvidia-nemotron-nano-omni",
    providerGroup: "nvidia",
    model: process.env.NVIDIA_NEMOTRON_NANO_OMNI_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    label: "NVIDIA Nemotron 3 Nano Omni",
    envKey: "NVIDIA_API_KEY",
    envKeys: ["NVIDIA_API_KEY", "NVIDIA_API_KEY2"],
    enabled: process.env.NVIDIA_VERIFICATION_ENABLED !== "false",
    supportsImage: true,
    endpoint: "nvidia",
    batch: 2,
  },
  {
    // OpenRouter Free verifier - uses the DEDICATED verification key ONLY
    // (VERIFICATION_OPENROUTER_API_KEY). Never reads OPENROUTER_API_KEY /
    // OPENROUTER_API_KEY2..4 (legacy keys used by other systems) or the
    // Ultra Bee key (ULTRA_BEE_OPENROUTER_API_KEY).
    provider: "openrouter-free",
    providerGroup: "openrouter",
    model: "openrouter/free",
    label: "OpenRouter Free",
    envKey: "VERIFICATION_OPENROUTER_API_KEY",
    enabled: process.env.OPENROUTER_VERIFICATION_ENABLED !== "false",
    supportsImage: true,
    endpoint: "openrouter",
    batch: 2,
  },
  {
    // Groq Qwen 3.6 27B verifier - dedicated GROQ_QWEN_36_API_KEY only.
    provider: "groq-qwen-36",
    providerGroup: "groq",
    model: "qwen/qwen3.6-27b",
    label: "Groq Qwen 3.6 27B",
    envKey: "GROQ_QWEN_36_API_KEY",
    enabled: true,
    supportsImage: true,
    endpoint: "groq",
    batch: 2,
  },
  {
    // Groq Qwen 3.8 27B verifier - dedicated GROQ_QWEN_38_API_KEY only.
    provider: "groq-qwen-38",
    providerGroup: "groq",
    model: "qwen/qwen3.8-27b",
    label: "Groq Qwen 3.8 27B",
    envKey: "GROQ_QWEN_38_API_KEY",
    enabled: true,
    supportsImage: true,
    endpoint: "groq",
    batch: 3,
  },
];

export function getCategoryContext(categoryId: string, title?: string, description?: string): CategoryVerificationContext {
  return categoryContexts[categoryId] || {
    id: categoryId,
    title: title || categoryId,
    description: description || "Hivez local issue report",
    expectedObjects: [],
    verificationMode: "issue_visible",
    prompt: "Assess only whether the visible media appears relevant to the selected Hivez report category.",
  };
}

/** Resolves the verification mode for a category (defaults to hazard-style "issue_visible"). */
export function getCategoryVerificationMode(categoryId: string): CategoryVerificationMode {
  return categoryContexts[categoryId]?.verificationMode || "issue_visible";
}

export function skippedProvider(config: ProviderConfig, status: NormalizedProviderResult["status"], reason: string): NormalizedProviderResult {
  return {
    label: config.label,
    provider: config.provider,
    providerGroup: config.providerGroup,
    model: config.model,
    status,
    success: false,
    reason,
  };
}
