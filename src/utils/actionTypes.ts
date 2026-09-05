/**
 * Deterministic action-type catalog for volunteer actions.
 *
 * Pure data + helpers - no AI. Organizers pick a type (or "custom") and the
 * system suggests roles, one type-specific field and useful evidence types.
 * "external" kinds (authority / professional work) are clearly labelled so
 * nobody assumes volunteers perform licensed or dangerous work themselves.
 */
import type {
  ActionKind,
  ActionTypeKey,
  EvidenceTypeKey,
} from "@/types/volunteering";

export interface ActionTypeMeta {
  key: ActionTypeKey;
  label: string;
  emoji: string;
  kind: ActionKind;
  description: string;
  defaultRoles: string[];
  /** The one type-specific field asked in the create form (optional). */
  primaryField?: { key: string; label: string; placeholder: string };
  /** Evidence types that are most useful for this action type. */
  evidenceTypes: EvidenceTypeKey[];
}

export const ACTION_TYPES: ActionTypeMeta[] = [
  {
    key: "search",
    label: "Search / Investigation",
    emoji: "🔍",
    kind: "volunteer",
    description: "Coordinate a physical or information search for a person, pet or item.",
    defaultRoles: ["Search Team", "Local Knowledge", "Coordinator"],
    primaryField: { key: "searchArea", label: "Search area", placeholder: "e.g. Andheri West, near the metro station" },
    evidenceTypes: ["REPORT", "PHOTO", "LOCATION_CONFIRMATION", "WITNESS_CONFIRMATION"],
  },
  {
    key: "meet_coordinate",
    label: "Meet / Coordinate",
    emoji: "👥",
    kind: "volunteer",
    description: "Bring the right people together to plan or coordinate next steps.",
    defaultRoles: ["Coordinator", "Note Taker"],
    evidenceTypes: ["REPORT", "PHOTO"],
  },
  {
    key: "call_contact",
    label: "Call / Contact",
    emoji: "📞",
    kind: "volunteer",
    description: "Contact shelters, organizations or people who can help.",
    defaultRoles: ["Caller", "Note Taker"],
    primaryField: { key: "contactTarget", label: "Who is being contacted", placeholder: "e.g. local animal shelters" },
    evidenceTypes: ["CONTACT_PROOF", "SCREENSHOT", "REPORT"],
  },
  {
    key: "contact_authority",
    label: "Contact Authority",
    emoji: "🏛️",
    kind: "external",
    description: "Reach the responsible department or authority. Volunteers coordinate - the authority acts.",
    defaultRoles: ["Authority Follow-Up", "Documentation"],
    primaryField: { key: "authorityName", label: "Authority / organization", placeholder: "e.g. Municipal Corporation" },
    evidenceTypes: ["CONTACT_PROOF", "AUTHORITY_RESPONSE", "SCREENSHOT", "DOCUMENT"],
  },
  {
    key: "complaint_report",
    label: "Submit Complaint / Report",
    emoji: "📝",
    kind: "external",
    description: "File an official complaint with a reference number you can follow up on.",
    defaultRoles: ["Complaint Filer", "Documentation"],
    primaryField: { key: "portalOrOffice", label: "Filed with", placeholder: "e.g. online portal / ward office" },
    evidenceTypes: ["DOCUMENT", "SCREENSHOT", "AUTHORITY_RESPONSE"],
  },
  {
    key: "collect_evidence",
    label: "Collect Evidence",
    emoji: "📸",
    kind: "volunteer",
    description: "Gather photos, videos, documents and reports that strengthen the issue's verification case.",
    defaultRoles: ["Evidence Collection", "Documentation"],
    primaryField: { key: "evidenceGoal", label: "What evidence is needed", placeholder: "e.g. clear photos of the pothole and surroundings" },
    evidenceTypes: ["PHOTO", "VIDEO", "DOCUMENT", "REPORT", "SCREENSHOT"],
  },
  {
    key: "spread_awareness",
    label: "Spread Awareness",
    emoji: "📢",
    kind: "volunteer",
    description: "Inform the community online and on the ground.",
    defaultRoles: ["Online Coordination", "Poster Run"],
    evidenceTypes: ["PHOTO", "SCREENSHOT", "REPORT"],
  },
  {
    key: "on_ground",
    label: "On-Ground Action",
    emoji: "🚶",
    kind: "volunteer",
    description: "Volunteers physically present at the location to act or observe.",
    defaultRoles: ["On-Ground Assistance", "Coordinator"],
    primaryField: { key: "meetingPoint", label: "Meeting point", placeholder: "e.g. main gate, 9 AM" },
    evidenceTypes: ["PHOTO", "DURING", "LOCATION_CONFIRMATION"],
  },
  {
    key: "cleanup",
    label: "Cleanup / Physical Work",
    emoji: "🧹",
    kind: "volunteer",
    description: "Hands-on community work volunteers can safely do themselves.",
    defaultRoles: ["Cleanup Crew", "Documentation", "Coordinator"],
    primaryField: { key: "supplies", label: "What to bring", placeholder: "e.g. gloves, bags, rakes" },
    evidenceTypes: ["BEFORE", "DURING", "AFTER", "PHOTO"],
  },
  {
    key: "professional_assistance",
    label: "Professional Assistance",
    emoji: "🔧",
    kind: "external",
    description: "Licensed or skilled work (electrical, structural, medical...). Volunteers coordinate and track - professionals perform the work.",
    defaultRoles: ["Professional Coordination", "Documentation"],
    primaryField: { key: "professionalType", label: "Type of professional needed", placeholder: "e.g. licensed electrician" },
    evidenceTypes: ["PROFESSIONAL_CONFIRMATION", "BEFORE", "AFTER", "PHOTO"],
  },
  {
    key: "rescue_recovery",
    label: "Rescue / Recovery",
    emoji: "🐾",
    kind: "external",
    description: "Animal rescue or recovery - done with trained rescuers or professionals, not untrained volunteers.",
    defaultRoles: ["Professional Coordination", "Spotter"],
    primaryField: { key: "rescuerContact", label: "Rescuer / organization", placeholder: "e.g. city animal rescue helpline" },
    evidenceTypes: ["PHOTO", "PROFESSIONAL_CONFIRMATION", "REPORT"],
  },
  {
    key: "location_verification",
    label: "Location Verification",
    emoji: "📍",
    kind: "volunteer",
    description: "Confirm the exact location or verify claimed work on site.",
    defaultRoles: ["Verifier", "Documentation"],
    evidenceTypes: ["LOCATION_CONFIRMATION", "PHOTO", "REPORT"],
  },
  {
    key: "community_coordination",
    label: "Community Coordination",
    emoji: "🤝",
    kind: "volunteer",
    description: "Organize volunteers, schedules and resources across actions.",
    defaultRoles: ["Coordinator", "Online Coordination"],
    evidenceTypes: ["REPORT"],
  },
  {
    key: "online_action",
    label: "Online Action",
    emoji: "💻",
    kind: "volunteer",
    description: "Research, forms, posts and coordination that can be done remotely.",
    defaultRoles: ["Online Coordination", "Research"],
    evidenceTypes: ["SCREENSHOT", "DOCUMENT", "REPORT"],
  },
  {
    key: "resource_collection",
    label: "Resource Collection",
    emoji: "📦",
    kind: "volunteer",
    description: "Collect supplies, donations or equipment the effort needs.",
    defaultRoles: ["Resource Lead", "Logistics"],
    primaryField: { key: "resourcesNeeded", label: "Resources needed", placeholder: "e.g. blankets, water bottles" },
    evidenceTypes: ["PHOTO", "REPORT"],
  },
  {
    key: "emergency_support",
    label: "Emergency Support",
    emoji: "🚨",
    kind: "external",
    description: "Urgent help - coordinate with emergency services; volunteers assist, they do not replace them.",
    defaultRoles: ["Coordinator", "Emergency Contact"],
    evidenceTypes: ["REPORT", "CONTACT_PROOF"],
  },
  {
    key: "custom",
    label: "Custom Action",
    emoji: "➕",
    kind: "volunteer",
    description: "Anything else this issue needs - fully organizer-defined.",
    defaultRoles: ["Volunteer"],
    evidenceTypes: ["PHOTO", "REPORT", "OTHER"],
  },
];

/** Deterministic issue-category → suggested action types (templates only, no AI). */
const CATEGORY_SUGGESTIONS: Record<string, ActionTypeKey[]> = {
  lost_pet: ["search", "spread_awareness", "call_contact", "rescue_recovery", "location_verification", "community_coordination"],
  animal_in_danger: ["rescue_recovery", "call_contact", "on_ground", "location_verification", "professional_assistance"],
  missing_person: ["search", "spread_awareness", "call_contact", "meet_coordinate", "location_verification", "community_coordination"],
  garbage: ["cleanup", "contact_authority", "complaint_report", "spread_awareness", "location_verification", "collect_evidence"],
  broken_road: ["collect_evidence", "contact_authority", "complaint_report", "call_contact", "location_verification", "professional_assistance"],
  street_light: ["contact_authority", "call_contact", "professional_assistance", "collect_evidence", "complaint_report"],
  water_leakage: ["collect_evidence", "contact_authority", "professional_assistance", "complaint_report", "location_verification"],
  electrical: ["contact_authority", "professional_assistance", "collect_evidence", "complaint_report", "spread_awareness"],
  illegal_parking: ["collect_evidence", "contact_authority", "complaint_report", "spread_awareness"],
  fallen_tree: ["on_ground", "contact_authority", "professional_assistance", "location_verification"],
  flooded_road: ["contact_authority", "on_ground", "location_verification", "spread_awareness"],
  damaged_property: ["collect_evidence", "contact_authority", "complaint_report", "professional_assistance"],
  blood_request: ["spread_awareness", "community_coordination", "meet_coordinate", "call_contact"],
  other: ["meet_coordinate", "collect_evidence", "contact_authority", "spread_awareness"],
};

export function getActionType(key: string | null | undefined): ActionTypeMeta | null {
  if (!key) return null;
  return ACTION_TYPES.find((item) => item.key === key) || null;
}

/** Suggested action types for an issue category - deterministic, no AI. */
export function suggestedActionTypes(category?: string | null): ActionTypeMeta[] {
  if (!category) return [];
  const keys = CATEGORY_SUGGESTIONS[category];
  if (!keys) return [];
  return keys
    .filter((key, index, all) => all.indexOf(key) === index)
    .map((key) => ACTION_TYPES.find((item) => item.key === key))
    .filter((item): item is ActionTypeMeta => Boolean(item));
}

/** User-facing label for an action's progress state. */
export function progressStateLabel(state: string | null | undefined): string {
  switch (state) {
    case "NOT_STARTED": return "Not started";
    case "IN_PROGRESS": return "In progress";
    case "WAITING_EXTERNAL": return "Waiting for external response";
    case "WAITING_PROFESSIONAL": return "Waiting for professional";
    case "AWAITING_EVIDENCE": return "Awaiting evidence";
    case "AWAITING_VERIFICATION": return "Awaiting verification";
    case "COMPLETED": return "Completed";
    default: return "In progress";
  }
}

