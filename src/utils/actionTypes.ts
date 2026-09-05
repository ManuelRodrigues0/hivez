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

/**
 * Per-action-type form field. Stored on the created activity under
 * `typeDetails[key]` - no new collections, fully backward compatible.
 */
export interface ActionFieldDef {
  /** Storage key under activity.typeDetails. */
  key: string;
  /** Human label shown in the form. */
  label: string;
  placeholder?: string;
  kind: "text" | "textarea" | "date" | "time" | "number" | "select";
  /** Options for kind === "select". */
  options?: readonly string[];
}

/**
 * Which shared launch fields and which type-specific fields an action type
 * uses. Keeps remote/coordination actions from forcing physical-event fields
 * (meeting point, capacity, schedule) that do not apply to them.
 */
export interface ActionFormConfig {
  /** Show date/time scheduling fields. */
  schedule: boolean;
  /** Show location + meeting point (physical presence is relevant). */
  meeting: boolean;
  /** Show a volunteer capacity limit. */
  capacity: boolean;
  /** Show the free-text roles field (false = use defaultRoles). */
  roles: boolean;
  /** Join-button label tailored to this action type. */
  joinLabel: string;
  /** Type-specific fields collected into activity.typeDetails. */
  fields: readonly ActionFieldDef[];
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

// =====================================================================
// ACTION FORM CONFIG
// Shared flags + type-specific fields shown only when relevant.
// =====================================================================

export const ACTION_FORM_DEFS: Record<ActionTypeKey, ActionFormConfig> = {
  search: {
    schedule: true,
    meeting: true,
    capacity: true,
    roles: true,
    joinLabel: "Join search",
    fields: [
      { key: "searchArea", label: "Search area / zones", placeholder: "e.g. MG Road, market area, nearby streets", kind: "textarea" },
      { key: "safetyNotes", label: "Safety notes", placeholder: "e.g. avoid isolated areas after dark", kind: "textarea" },
    ],
  },
  meet_coordinate: {
    schedule: true,
    meeting: true,
    capacity: true,
    roles: true,
    joinLabel: "Join meeting",
    fields: [
      { key: "agenda", label: "Agenda", placeholder: "What will be discussed / coordinated", kind: "textarea" },
      { key: "bringItems", label: "Things to bring", placeholder: "e.g. contact lists, printouts", kind: "text" },
    ],
  },
  call_contact: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Help contact",
    fields: [
      { key: "contactTarget", label: "Who should be contacted", placeholder: "e.g. animal shelters in the area", kind: "text" },
      { key: "contactDetails", label: "Contact info", placeholder: "Phone / email / website if available", kind: "textarea" },
      { key: "contactGoal", label: "What to communicate", placeholder: "What each person should pass on", kind: "textarea" },
      { key: "followUpDate", label: "Follow-up date", kind: "date" },
    ],
  },
  contact_authority: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Help contact",
    fields: [
      { key: "authorityName", label: "Authority / department", placeholder: "e.g. Municipal Corporation, ward office", kind: "text" },
      { key: "authorityContact", label: "Contact details", placeholder: "Phone / email / grievance portal", kind: "textarea" },
      { key: "complaintReference", label: "Complaint / reference number", placeholder: "e.g. MC-10234 (if already filed)", kind: "text" },
      { key: "followUpDate", label: "Follow-up date", kind: "date" },
    ],
  },
  complaint_report: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Submit / join",
    fields: [
      { key: "filedWith", label: "Where to submit", placeholder: "e.g. online portal, ward office", kind: "text" },
      { key: "supportingEvidence", label: "Required supporting evidence", placeholder: "What documents / photos each filing should include", kind: "textarea" },
      { key: "deadline", label: "Submission deadline", kind: "date" },
    ],
  },
  collect_evidence: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Contribute evidence",
    fields: [
      { key: "evidenceGoal", label: "What evidence is needed", placeholder: "e.g. before photos, current condition, witness statements", kind: "textarea" },
      { key: "evidenceInstructions", label: "Instructions", placeholder: "How to capture and label submissions", kind: "textarea" },
      { key: "deadline", label: "Deadline", kind: "date" },
    ],
  },
  spread_awareness: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Help spread the word",
    fields: [
      { key: "awarenessMessage", label: "Information to share", placeholder: "The message / ask to amplify", kind: "textarea" },
      { key: "targetAudience", label: "Target audience", placeholder: "e.g. residents near MG Road", kind: "text" },
      { key: "channels", label: "Channels / areas", placeholder: "e.g. WhatsApp groups, posters in the market area", kind: "text" },
      { key: "endDate", label: "End date", kind: "date" },
    ],
  },
  on_ground: {
    schedule: true,
    meeting: true,
    capacity: true,
    roles: true,
    joinLabel: "Join on-ground team",
    fields: [
      { key: "onGroundScope", label: "What to do on the ground", placeholder: "What volunteers will do at the location", kind: "textarea" },
      { key: "safetyNotes", label: "Safety instructions", kind: "textarea" },
    ],
  },
  cleanup: {
    schedule: true,
    meeting: true,
    capacity: true,
    roles: true,
    joinLabel: "Join cleanup",
    fields: [
      { key: "supplies", label: "Materials / supplies", placeholder: "e.g. gloves, garbage bags, rakes", kind: "textarea" },
      { key: "safetyNotes", label: "Safety instructions", kind: "textarea" },
    ],
  },
  professional_assistance: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Assist coordination",
    fields: [
      { key: "professionalType", label: "Professional needed", placeholder: "e.g. licensed electrician, structural engineer", kind: "text" },
      { key: "professionalOrg", label: "Organization / professional contacted", placeholder: "Optional - if already identified", kind: "text" },
      {
        key: "contactStatus",
        label: "Contact status",
        kind: "select",
        options: [
          "Looking for professional",
          "Professional contacted",
          "Awaiting response",
          "Professional assigned",
          "Work scheduled",
          "Work in progress",
          "Work completed",
        ],
      },
      { key: "workDate", label: "Estimated work date", kind: "date" },
      { key: "notes", label: "Notes", kind: "textarea" },
    ],
  },
  rescue_recovery: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Volunteer assist",
    fields: [
      { key: "rescuerContact", label: "Rescuer / organization", placeholder: "e.g. city animal rescue helpline", kind: "text" },
      { key: "lastKnownLocation", label: "Last known location", kind: "text" },
      { key: "lastSeenTime", label: "Last seen", placeholder: "e.g. today 6 PM", kind: "text" },
      { key: "safetyInstructions", label: "Safety instructions", placeholder: "Do not approach - let trained responders handle rescue", kind: "textarea" },
    ],
  },
  location_verification: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Join verification",
    fields: [
      { key: "whatToCheck", label: "What should be checked", placeholder: "e.g. does the pothole still exist? Is repair work done?", kind: "textarea" },
      { key: "verificationInstructions", label: "Instructions", kind: "textarea" },
      { key: "deadline", label: "Optional deadline", kind: "date" },
    ],
  },
  community_coordination: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Join coordination",
    fields: [
      { key: "coordinationGoal", label: "What to coordinate", placeholder: "e.g. rostering volunteers across search and awareness", kind: "textarea" },
    ],
  },
  online_action: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Join online",
    fields: [
      { key: "objective", label: "Objective", kind: "textarea" },
      { key: "onlineTasks", label: "Tasks", placeholder: "e.g. compile shelter list, fill online forms", kind: "textarea" },
      { key: "contributorsNeeded", label: "Contributors needed", kind: "number" },
      { key: "deadline", label: "Deadline", kind: "date" },
    ],
  },
  resource_collection: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Donate / contribute",
    fields: [
      { key: "resourcesNeeded", label: "Resources needed", placeholder: "e.g. blankets (20), water bottles (30) - one per line with target", kind: "textarea" },
      { key: "collectionPoint", label: "Collection point", placeholder: "Optional - where to drop supplies", kind: "text" },
      { key: "deadline", label: "Deadline", kind: "date" },
    ],
  },
  emergency_support: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Assist coordination",
    fields: [
      { key: "urgency", label: "Urgency", kind: "select", options: ["High", "Medium", "Low"] },
      { key: "supportNeeded", label: "Type of support needed", kind: "textarea" },
      { key: "safetyInstructions", label: "Safety messaging", placeholder: "Community coordinates support - emergency services remain the first responder", kind: "textarea" },
      { key: "coordinationNotes", label: "Coordination notes", kind: "textarea" },
    ],
  },
  custom: {
    schedule: false,
    meeting: false,
    capacity: false,
    roles: true,
    joinLabel: "Join action",
    fields: [
      { key: "customDetails", label: "Additional details", placeholder: "Anything participants should know", kind: "textarea" },
    ],
  },
};

/** Form config for any action type, with a safe fallback to custom. */
export function getActionFormConfig(key: ActionTypeKey | null | undefined): ActionFormConfig {
  return ACTION_FORM_DEFS[key || "custom"] || ACTION_FORM_DEFS.custom;
}

/** Groups of action types for a discoverable chooser (pure presentation). */
export const ACTION_TYPE_GROUPS: { label: string; keys: ActionTypeKey[] }[] = [
  { label: "Community / On-ground", keys: ["cleanup", "on_ground", "meet_coordinate", "search"] },
  { label: "External / coordination", keys: ["call_contact", "contact_authority", "complaint_report", "professional_assistance"] },
  { label: "Evidence / information", keys: ["collect_evidence", "location_verification", "online_action", "spread_awareness"] },
  { label: "Recovery & safety", keys: ["rescue_recovery", "emergency_support"] },
  { label: "Other", keys: ["resource_collection", "community_coordination", "custom"] },
];

/** Action-specific create-button label. */
export function createActionLabel(key: ActionTypeKey | null | undefined): string {
  switch (key) {
    case "search": return "Create search";
    case "meet_coordinate": return "Create meeting";
    case "call_contact": return "Create contact action";
    case "contact_authority": return "Create authority contact";
    case "complaint_report": return "Create complaint campaign";
    case "collect_evidence": return "Create evidence task";
    case "spread_awareness": return "Create awareness campaign";
    case "on_ground": return "Create on-ground action";
    case "cleanup": return "Create cleanup";
    case "professional_assistance": return "Create professional task";
    case "rescue_recovery": return "Create rescue action";
    case "location_verification": return "Create location check";
    case "community_coordination": return "Create coordination";
    case "online_action": return "Create online action";
    case "resource_collection": return "Create collection drive";
    case "emergency_support": return "Create support action";
    default: return "Create action";
  }
}

/**
 * Type-specific summary rows for a created action, derived from the live
 * activity's `typeDetails`. Used by action cards so each type displays its
 * own relevant configuration (no generic all-purpose card).
 */
export function actionTypeSummary(
  activity: {
    actionType?: ActionTypeKey | null;
    typeDetails?: Record<string, string> | null;
  }
): { key: string; label: string; value: string }[] {
  const config = getActionFormConfig(activity.actionType);
  const details = activity.typeDetails || {};
  return config.fields
    .filter((field) => Boolean(details[field.key]))
    .map((field) => ({ key: field.key, label: field.label, value: details[field.key]! }));
}

