export type VerificationStatus =
  | "pending"
  | "ai_checked"
  | "requires_review"
  | "failed"
  | "local_model_only";

export type VerificationLevel = "high_confidence" | "medium_confidence" | "low_confidence";
export type GeminiVerificationMode = "always" | "on_uncertain" | "disabled";
export type ReportUrgency = "normal" | "important" | "urgent";

export interface ReportFieldConfig {
  id: string;
  label: string;
  placeholder: string;
  required?: boolean;
}

export interface ReportCategoryConfig {
  id: string;
  title: string;
  communityId: string;
  description: string;
  icon: string;
  cameraAllowed: boolean;
  galleryAllowed: boolean;
  videoAllowed: boolean;
  requiresMedia: boolean;
  verificationModel: string | null;
  mediaTitle: string;
  mediaHelp: string;
  cameraLabel?: string;
  galleryLabel?: string;
  videoLabel?: string;
  verification: {
    highConfidence: number;
    mediumConfidence: number;
    geminiMode: GeminiVerificationMode;
    geminiInstructions: string;
  };
  fields: ReportFieldConfig[];
}

export const verificationConfig = {
  highConfidence: 0.9,
  mediumConfidence: 0.7,
};

const defaultInstructions =
  "Assess whether the visible media appears relevant to the selected Hivez report category. Do not claim the report is true.";

export const REPORT_CATEGORIES: ReportCategoryConfig[] = [
  {
    id: "lost_pet",
    title: "Lost Pet",
    communityId: "lost-pets",
    description: "Report a missing or lost animal",
    icon: "Dog",
    cameraAllowed: false,
    galleryAllowed: true,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: "lost-pet",
    mediaTitle: "Upload a photo of the lost pet",
    mediaHelp: "Use an existing clear photo or video of the animal people should look for.",
    galleryLabel: "Choose from Gallery",
    videoLabel: "Upload Video",
    verification: {
      ...verificationConfig,
      geminiMode: "always",
      geminiInstructions:
        "Analyze this as a Lost Pet report. Check whether an animal is visible and the image is usable. Do not claim the animal is actually lost.",
    },
    fields: [
      {
        id: "lastSeen",
        label: "Where was the pet last seen?",
        placeholder: "Near the park gate, around 6 PM",
      },
    ],
  },
  {
    id: "garbage",
    title: "Garbage / Waste",
    communityId: "waste",
    description: "Overflowing bins, dumping, or waste hazards",
    icon: "Trash2",
    cameraAllowed: true,
    galleryAllowed: false,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: "garbage",
    mediaTitle: "Capture the garbage",
    mediaHelp: "Take a clear photo showing the garbage and surrounding area.",
    cameraLabel: "Open Camera",
    videoLabel: "Upload Video",
    verification: {
      ...verificationConfig,
      geminiMode: "on_uncertain",
      geminiInstructions: defaultInstructions,
    },
    fields: [{ id: "wasteType", label: "Describe the garbage/waste.", placeholder: "Overflowing bin, dumped plastic, construction debris" }],
  },
  {
    id: "broken_road",
    title: "Broken Road",
    communityId: "roads",
    description: "Potholes, cracks, or unsafe road damage",
    icon: "Construction",
    cameraAllowed: true,
    galleryAllowed: false,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: "road-damage",
    mediaTitle: "Capture the road damage",
    mediaHelp: "Show the damage and enough nearby context for people to recognize the spot.",
    cameraLabel: "Open Camera",
    videoLabel: "Upload Video",
    verification: { ...verificationConfig, geminiMode: "on_uncertain", geminiInstructions: defaultInstructions },
    fields: [{ id: "damage", label: "What is damaged?", placeholder: "Large pothole in the left lane" }],
  },
  {
    id: "street_light",
    title: "Street Light",
    communityId: "street-lights",
    description: "Broken lights, dark roads, or unsafe lighting",
    icon: "Lightbulb",
    cameraAllowed: true,
    galleryAllowed: false,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: "street-light",
    mediaTitle: "Capture the street light",
    mediaHelp: "Show the light pole and nearby street context.",
    cameraLabel: "Open Camera",
    videoLabel: "Upload Video",
    verification: { ...verificationConfig, geminiMode: "on_uncertain", geminiInstructions: defaultInstructions },
    fields: [{ id: "lightIssue", label: "What is wrong with the light?", placeholder: "Light flickers or has been off for two nights" }],
  },
  {
    id: "water_leakage",
    title: "Water Leakage",
    communityId: "water-leakage",
    description: "Leaks, burst pipes, or water waste",
    icon: "Droplets",
    cameraAllowed: true,
    galleryAllowed: false,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: "water-leakage",
    mediaTitle: "Capture the leakage",
    mediaHelp: "Show the leak source and how far the water has spread.",
    cameraLabel: "Open Camera",
    videoLabel: "Upload Video",
    verification: { ...verificationConfig, geminiMode: "on_uncertain", geminiInstructions: defaultInstructions },
    fields: [{ id: "leakage", label: "Describe the leakage.", placeholder: "Water leaking from pipe beside the footpath" }],
  },
  {
    id: "electrical",
    title: "Dangerous Electrical Wire",
    communityId: "electric-hazards",
    description: "Exposed wires, damaged poles, or electrical risk",
    icon: "Zap",
    cameraAllowed: true,
    galleryAllowed: false,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: "electrical",
    mediaTitle: "Capture the electrical hazard",
    mediaHelp: "Keep distance. Show the hazard clearly without moving close to it.",
    cameraLabel: "Open Camera",
    videoLabel: "Upload Video",
    verification: { ...verificationConfig, geminiMode: "always", geminiInstructions: defaultInstructions },
    fields: [{ id: "hazard", label: "What is dangerous?", placeholder: "Loose wire hanging near the bus stop" }],
  },
  {
    id: "illegal_parking",
    title: "Illegal Parking",
    communityId: "illegal-parking",
    description: "Blocked roads, gates, or unsafe parking",
    icon: "Car",
    cameraAllowed: true,
    galleryAllowed: false,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: "parking",
    mediaTitle: "Capture the parking issue",
    mediaHelp: "Show the obstruction and surrounding context.",
    cameraLabel: "Open Camera",
    videoLabel: "Upload Video",
    verification: { ...verificationConfig, geminiMode: "on_uncertain", geminiInstructions: defaultInstructions },
    fields: [{ id: "parkingIssue", label: "What is blocked?", placeholder: "Vehicle blocking building entrance" }],
  },
  {
    id: "fallen_tree",
    title: "Fallen Tree",
    communityId: "fallen-trees",
    description: "Fallen trees or branches blocking access",
    icon: "TreePine",
    cameraAllowed: true,
    galleryAllowed: false,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: "fallen-tree",
    mediaTitle: "Capture the fallen tree",
    mediaHelp: "Show what is blocked and whether it appears dangerous.",
    cameraLabel: "Open Camera",
    videoLabel: "Upload Video",
    verification: { ...verificationConfig, geminiMode: "on_uncertain", geminiInstructions: defaultInstructions },
    fields: [{ id: "treeImpact", label: "What is affected?", placeholder: "Tree blocking one side of the road" }],
  },
  {
    id: "flooded_road",
    title: "Flooded Road",
    communityId: "roads",
    description: "Waterlogged roads or flooding",
    icon: "Waves",
    cameraAllowed: true,
    galleryAllowed: false,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: "flooding",
    mediaTitle: "Capture the flooded road",
    mediaHelp: "Show the water level and nearby road context.",
    cameraLabel: "Open Camera",
    videoLabel: "Upload Video",
    verification: { ...verificationConfig, geminiMode: "always", geminiInstructions: defaultInstructions },
    fields: [{ id: "flooding", label: "Describe the flooding.", placeholder: "Water up to footpath near the junction" }],
  },
  {
    id: "animal_in_danger",
    title: "Animal in Danger",
    communityId: "lost-pets",
    description: "Injured, trapped, or unsafe animals",
    icon: "HeartPulse",
    cameraAllowed: true,
    galleryAllowed: true,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: "lost-pet",
    mediaTitle: "Capture or upload evidence",
    mediaHelp: "Show the animal and the situation clearly, without putting yourself at risk.",
    cameraLabel: "Open Camera",
    galleryLabel: "Choose from Gallery",
    videoLabel: "Upload Video",
    verification: { ...verificationConfig, geminiMode: "always", geminiInstructions: defaultInstructions },
    fields: [{ id: "animalCondition", label: "What help does the animal need?", placeholder: "Dog appears injured near the divider" }],
  },
  {
    id: "blood_request",
    title: "Blood Request",
    communityId: "blood-requests",
    description: "Ask nearby people for urgent blood donation help",
    icon: "HeartHandshake",
    cameraAllowed: false,
    galleryAllowed: false,
    videoAllowed: false,
    requiresMedia: false,
    verificationModel: null,
    mediaTitle: "Add request details",
    mediaHelp: "Blood requests use structured details instead of image AI checks.",
    verification: { ...verificationConfig, geminiMode: "disabled", geminiInstructions: "" },
    fields: [
      { id: "bloodGroup", label: "Blood group", placeholder: "O+, AB-, unknown", required: true },
      { id: "hospital", label: "Hospital or location", placeholder: "Hospital name and area", required: true },
      { id: "contact", label: "Contact information", placeholder: "Phone or coordinator details" },
    ],
  },
  {
    id: "missing_person",
    title: "Missing Person",
    communityId: "missing-persons",
    description: "Share a missing person alert without facial recognition",
    icon: "UserRoundSearch",
    cameraAllowed: false,
    galleryAllowed: true,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: null,
    mediaTitle: "Upload reference media",
    mediaHelp: "AI can only assess image usability and category relevance. It will not identify a person.",
    galleryLabel: "Choose from Gallery",
    videoLabel: "Upload Video",
    verification: {
      ...verificationConfig,
      geminiMode: "always",
      geminiInstructions:
        "For a Missing Person report, assess only whether the image is usable and relevant. Do not identify or verify the identity of any person.",
    },
    fields: [{ id: "lastSeen", label: "Where was the person last seen?", placeholder: "Area, time, clothing, or known details" }],
  },
  {
    id: "damaged_property",
    title: "Damaged Property",
    communityId: "roads",
    description: "Public or shared property damage",
    icon: "HousePlus",
    cameraAllowed: true,
    galleryAllowed: false,
    videoAllowed: true,
    requiresMedia: true,
    verificationModel: null,
    mediaTitle: "Capture the damage",
    mediaHelp: "Show the damaged property and surrounding context.",
    cameraLabel: "Open Camera",
    videoLabel: "Upload Video",
    verification: { ...verificationConfig, geminiMode: "on_uncertain", geminiInstructions: defaultInstructions },
    fields: [{ id: "propertyDamage", label: "What was damaged?", placeholder: "Broken bench, damaged sign, cracked wall" }],
  },
  {
    id: "other",
    title: "Other",
    communityId: "community",
    description: "Report something that does not fit another category",
    icon: "CircleHelp",
    cameraAllowed: true,
    galleryAllowed: true,
    videoAllowed: true,
    requiresMedia: false,
    verificationModel: null,
    mediaTitle: "Add evidence",
    mediaHelp: "Add a photo or video if it helps people understand the issue.",
    cameraLabel: "Open Camera",
    galleryLabel: "Choose from Gallery",
    videoLabel: "Upload Video",
    verification: { ...verificationConfig, geminiMode: "disabled", geminiInstructions: "" },
    fields: [{ id: "issueType", label: "What type of issue is this?", placeholder: "Briefly name the issue" }],
  },
];

export function getReportCategory(categoryId: string) {
  return REPORT_CATEGORIES.find((category) => category.id === categoryId) || null;
}

export function classifyConfidence(confidence: number, category = verificationConfig): VerificationLevel {
  if (confidence >= category.highConfidence) return "high_confidence";
  if (confidence >= category.mediumConfidence) return "medium_confidence";
  return "low_confidence";
}
