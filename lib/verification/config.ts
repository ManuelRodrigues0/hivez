import type { NormalizedProviderResult } from "./types";

export const MAX_BASE64_LENGTH = 3_800_000;

export interface CategoryVerificationContext {
  id: string;
  title: string;
  description: string;
  expectedObjects: string[];
  prompt: string;
}

export interface ProviderConfig {
  provider: string;
  providerGroup: string;
  model: string;
  envKey?: string;
  enabled: boolean;
  supportsImage: boolean;
  endpoint: "gemini" | "xai" | "nvidia" | "openrouter";
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
    prompt: "Determine whether the image visibly contains a relevant animal. Do not determine whether the animal is actually lost.",
  },
  garbage: {
    id: "garbage",
    title: "Garbage / Waste",
    description: "Overflowing bins, dumping, or waste hazards",
    expectedObjects: ["garbage", "trash", "waste", "overflowing bin", "dumping"],
    prompt: "Determine whether visible garbage or waste is present.",
  },
  broken_road: {
    id: "broken_road",
    title: "Broken Road",
    description: "Potholes, cracks, or unsafe road damage",
    expectedObjects: ["pothole", "road crack", "damaged road", "unsafe road"],
    prompt: "Determine whether potholes, cracks, or relevant road damage are visible.",
  },
  street_light: {
    id: "street_light",
    title: "Street Light",
    description: "Broken lights, dark roads, or unsafe lighting",
    expectedObjects: ["street light", "light pole", "lamp post", "broken light"],
    prompt: "Determine whether a street light is visible and whether obvious damage or lighting issue evidence is visible.",
  },
  water_leakage: {
    id: "water_leakage",
    title: "Water Leakage",
    description: "Leaks, burst pipes, or water waste",
    expectedObjects: ["water leak", "burst pipe", "leaking infrastructure", "water flow"],
    prompt: "Determine whether visible water leakage from relevant infrastructure is present.",
  },
  electrical: {
    id: "electrical",
    title: "Dangerous Electrical Wire",
    description: "Exposed wires, damaged poles, or electrical risk",
    expectedObjects: ["wire", "electrical pole", "exposed cable", "fallen wire"],
    prompt: "Determine whether potentially dangerous exposed or fallen electrical infrastructure is visually present. Do not make definitive safety or legal claims.",
  },
  illegal_parking: {
    id: "illegal_parking",
    title: "Illegal Parking",
    description: "Blocked roads, gates, or unsafe parking",
    expectedObjects: ["vehicle", "blocked road", "blocked sidewalk", "parking obstruction"],
    prompt: "Determine whether the image visually shows a vehicle blocking a road, gate, or sidewalk where applicable. Do not make definitive legal conclusions.",
  },
  fallen_tree: {
    id: "fallen_tree",
    title: "Fallen Tree",
    description: "Fallen trees or branches blocking access",
    expectedObjects: ["fallen tree", "fallen branch", "blocked road", "tree debris"],
    prompt: "Determine whether a fallen tree or fallen branch is visibly present.",
  },
  flooded_road: {
    id: "flooded_road",
    title: "Flooded Road",
    description: "Waterlogged roads or flooding",
    expectedObjects: ["flooding", "waterlogged road", "standing water", "flooded street"],
    prompt: "Determine whether flooding or significant waterlogging is visibly present.",
  },
  animal_in_danger: {
    id: "animal_in_danger",
    title: "Animal in Danger",
    description: "Injured, trapped, or unsafe animals",
    expectedObjects: ["animal", "injured animal", "trapped animal", "animal danger"],
    prompt: "Determine whether an animal and visually observable signs of a potentially dangerous situation are present. Do not make unsupported medical claims.",
  },
  damaged_property: {
    id: "damaged_property",
    title: "Damaged Property",
    description: "Public or shared property damage",
    expectedObjects: ["broken property", "damaged public asset", "cracked wall", "broken sign"],
    prompt: "Determine whether visually observable property damage is present.",
  },
};

export const providerConfigs: ProviderConfig[] = [
  {
    provider: "gemini",
    providerGroup: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
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
    envKey: "NVIDIA_API_KEY",
    enabled: process.env.NVIDIA_VERIFICATION_ENABLED !== "false",
    supportsImage: true,
    endpoint: "nvidia",
    batch: 2,
  },
  {
    provider: "openrouter-free",
    providerGroup: "openrouter",
    model: "openrouter/free",
    envKey: "OPENROUTER_API_KEY",
    enabled: process.env.OPENROUTER_VERIFICATION_ENABLED !== "false",
    supportsImage: true,
    endpoint: "openrouter",
    batch: 2,
  },
  {
    provider: "openrouter-nemotron-nano-vl",
    providerGroup: "openrouter",
    model: "nvidia/nemotron-nano-12b-v2-vl:free",
    envKey: "OPENROUTER_API_KEY",
    enabled: process.env.OPENROUTER_VERIFICATION_ENABLED !== "false",
    supportsImage: true,
    endpoint: "openrouter",
    batch: 3,
  },
  {
    provider: "openrouter-gemma-31b",
    providerGroup: "openrouter",
    model: "google/gemma-4-31b-it:free",
    envKey: "OPENROUTER_API_KEY",
    enabled: process.env.OPENROUTER_VERIFICATION_ENABLED !== "false",
    supportsImage: process.env.OPENROUTER_GEMMA_VISION_ENABLED === "true",
    endpoint: "openrouter",
    batch: 3,
  },
  {
    provider: "openrouter-gemma-26b",
    providerGroup: "openrouter",
    model: "google/gemma-4-26b-a4b-it:free",
    envKey: "OPENROUTER_API_KEY",
    enabled: process.env.OPENROUTER_VERIFICATION_ENABLED !== "false",
    supportsImage: process.env.OPENROUTER_GEMMA_VISION_ENABLED === "true",
    endpoint: "openrouter",
    batch: 3,
  },
];

export function getCategoryContext(categoryId: string, title?: string, description?: string): CategoryVerificationContext {
  return categoryContexts[categoryId] || {
    id: categoryId,
    title: title || categoryId,
    description: description || "Hivez local issue report",
    expectedObjects: [],
    prompt: "Assess only whether the visible media appears relevant to the selected Hivez report category.",
  };
}

export function skippedProvider(config: ProviderConfig, status: NormalizedProviderResult["status"], reason: string): NormalizedProviderResult {
  return {
    provider: config.provider,
    providerGroup: config.providerGroup,
    model: config.model,
    status,
    success: false,
    reason,
  };
}
