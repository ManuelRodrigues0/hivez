/**
 * Ultra Bee - Hivez's AI assistant participant.
 *
 * Ultra Bee is a logical/system participant (NOT a Firebase Auth user): it is
 * represented as a stable participant id inside the existing chats collection,
 * so the normal chat UI, listeners and rules work unchanged. One conversation
 * per user: chats/{uid}_ultra-bee (sorted pair id, same as normal chats).
 */
import ultraBeeAvatar from "@/assets/auth/stationary-bee.png";

/** Stable internal identifier - never use a random id for Ultra Bee. */
export const ULTRA_BEE_ID = "ultra-bee";

export const ULTRA_BEE_DISPLAY_NAME = "Ultra Bee";
export const ULTRA_BEE_USERNAME = "ultra-bee";
export const ULTRA_BEE_TAGLINE = "Your Hivez AI Assistant";
export const ULTRA_BEE_WELCOME =
  "Hi! I'm Ultra Bee, your Hivez AI assistant. Ask me anything about Hivez - posting reports, communities, volunteering, polls, chats and more.";

/**
 * Participant profile used in chat docs (participantProfiles) and in the DM
 * list/header. The avatar is an existing Hivez bee asset and can be replaced
 * later by swapping the imported file.
 */
export const ULTRA_BEE_PROFILE = {
  uid: ULTRA_BEE_ID,
  username: ULTRA_BEE_USERNAME,
  displayName: ULTRA_BEE_DISPLAY_NAME,
  photoURL: ultraBeeAvatar,
  verified: true,
  bio: ULTRA_BEE_TAGLINE,
} as const;

/** Stable per-user conversation id, matching the existing chatIdFor format. */
export function ultraBeeChatIdFor(uid: string): string {
  return [uid, ULTRA_BEE_ID].sort().join("_");
}
