import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/firebase/firebase";
import { isBlockedBetween } from "@/services/blocks";

export type AccountPrivacy = "public" | "private";
export type MessagePrivacy = "everyone" | "followers" | "following" | "mutuals" | "nobody";
export type InteractionPrivacy = "everyone" | "followers" | "nobody";

export interface UserPrivacySettings {
  account: AccountPrivacy;
  messages: MessagePrivacy;
  mentions: InteractionPrivacy;
  comments: InteractionPrivacy;
  discoverable: boolean;
}

export interface SearchableUser {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  verified: boolean;
  bio?: string;
}

export const DEFAULT_PRIVACY: UserPrivacySettings = {
  account: "public",
  messages: "everyone",
  mentions: "everyone",
  comments: "everyone",
  discoverable: true,
};

/** How the current viewer prefers to see posts the author flagged as sensitive. */
export type SensitiveContentPreference = "show" | "blur" | "hide";

export function sensitiveContentPreference(profile?: DocumentData | null): SensitiveContentPreference {
  const raw = (profile?.preferences as { sensitiveContent?: string } | undefined)?.sensitiveContent;
  return raw === "blur" || raw === "hide" ? raw : "show";
}

export async function saveSensitiveContentPreference(uid: string, pref: SensitiveContentPreference) {
  await setDoc(
    doc(db, "users", uid),
    {
      preferences: { sensitiveContent: pref },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function cleanSearchText(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function normalizePrivacy(profile?: DocumentData | null): UserPrivacySettings {
  const raw = (profile?.privacy || {}) as Partial<UserPrivacySettings>;
  const legacyPrivate =
    profile?.isPrivate === true ||
    profile?.privateAccount === true ||
    profile?.accountPrivacy === "private";
  const account: AccountPrivacy = raw.account === "private" || legacyPrivate ? "private" : "public";
  const defaultMessages = account === "private" ? "followers" : DEFAULT_PRIVACY.messages;

  return {
    account,
    messages:
      raw.messages === "followers" ||
      raw.messages === "following" ||
      raw.messages === "mutuals" ||
      raw.messages === "nobody" ||
      raw.messages === "everyone"
        ? raw.messages
        : defaultMessages,
    mentions:
      raw.mentions === "followers" || raw.mentions === "nobody" || raw.mentions === "everyone"
        ? raw.mentions
        : DEFAULT_PRIVACY.mentions,
    comments:
      raw.comments === "followers" || raw.comments === "nobody" || raw.comments === "everyone"
        ? raw.comments
        : DEFAULT_PRIVACY.comments,
    discoverable: raw.discoverable === false ? false : DEFAULT_PRIVACY.discoverable,
  };
}

export function visibilityForProfile(profile?: DocumentData | null): "public" | "followers" {
  return normalizePrivacy(profile).account === "private" ? "followers" : "public";
}

export async function getUserProfileData(uid: string) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

export async function isFollowing(followerId: string | null | undefined, targetId: string | null | undefined) {
  if (!followerId || !targetId || followerId === targetId) return false;
  const snap = await getDoc(doc(db, "follows", `${followerId}_${targetId}`));
  if (snap.exists()) return true;
  const subSnap = await getDoc(doc(db, "users", followerId, "following", targetId));
  return subSnap.exists();
}

export async function canViewProfileContent(
  viewerId: string | null | undefined,
  profileId: string,
  profileData?: DocumentData | null
) {
  if (viewerId === profileId) return true;
  if (await isBlockedBetween(viewerId, profileId)) return false;
  const data = profileData ?? (await getUserProfileData(profileId));
  const privacy = normalizePrivacy(data);
  if (privacy.account === "public") return true;
  return isFollowing(viewerId, profileId);
}

export async function canUserAccessPost(
  viewerId: string | null | undefined,
  post: { uid?: string; visibility?: string; deleted?: boolean } | null | undefined
) {
  if (!post || !post.uid || post.deleted) return false;
  if (viewerId === post.uid) return true;
  if (await isBlockedBetween(viewerId, post.uid)) return false;

  const author = await getUserProfileData(post.uid);
  const authorPrivacy = normalizePrivacy(author);
  const protectedPost = post.visibility === "followers" || post.visibility === "private" || authorPrivacy.account === "private";
  if (!protectedPost) return true;
  return isFollowing(viewerId, post.uid);
}

export async function filterVisiblePosts<T extends { uid?: string; visibility?: string; deleted?: boolean }>(
  viewerId: string | null | undefined,
  posts: T[]
) {
  const authorIds = [...new Set(posts.map((post) => post.uid).filter(Boolean))] as string[];
  const profiles = new Map<string, DocumentData | null>();
  await Promise.all(
    authorIds.map(async (uid) => {
      profiles.set(uid, await getUserProfileData(uid));
    })
  );

  const privateAuthorIds = authorIds.filter((uid) => normalizePrivacy(profiles.get(uid)).account === "private");
  const followAccess = new Set<string>();
  await Promise.all(
    privateAuthorIds.map(async (uid) => {
      if (viewerId === uid || (await isFollowing(viewerId, uid))) followAccess.add(uid);
    })
  );

  // Blocked pairs are hidden in both directions: the viewer never sees content
  // from an author they blocked, and an author's block of the viewer is
  // respected too.
  const blockedAuthors = new Set<string>();
  await Promise.all(
    authorIds.map(async (uid) => {
      if (uid !== viewerId && (await isBlockedBetween(viewerId, uid))) blockedAuthors.add(uid);
    })
  );

  return posts.filter((post) => {
    if (!post.uid || post.deleted) return false;
    if (viewerId === post.uid) return true;
    if (blockedAuthors.has(post.uid)) return false;
    const privacy = normalizePrivacy(profiles.get(post.uid));
    const protectedPost = post.visibility === "followers" || post.visibility === "private" || privacy.account === "private";
    return !protectedPost || followAccess.has(post.uid);
  });
}

export async function canMessageUser(senderId: string | null | undefined, recipientId: string) {
  if (!senderId || senderId === recipientId) return false;
  if (await isBlockedBetween(senderId, recipientId)) return false;
  const profile = await getUserProfileData(recipientId);
  const privacy = normalizePrivacy(profile);
  if (privacy.messages === "everyone") return true;
  if (privacy.messages === "nobody") return false;

  const senderFollowsRecipient = await isFollowing(senderId, recipientId);
  if (privacy.messages === "followers") return senderFollowsRecipient;

  const recipientFollowsSender = await isFollowing(recipientId, senderId);
  if (privacy.messages === "following") return recipientFollowsSender;
  return senderFollowsRecipient && recipientFollowsSender;
}

export async function canMentionUser(actorId: string | null | undefined, targetId: string) {
  if (!actorId || actorId === targetId) return true;
  const profile = await getUserProfileData(targetId);
  const privacy = normalizePrivacy(profile);
  if (privacy.mentions === "everyone") return true;
  if (privacy.mentions === "nobody") return false;
  return isFollowing(actorId, targetId);
}

export async function canCommentOnPost(actorId: string | null | undefined, post: { uid?: string }) {
  if (!actorId || !post.uid) return false;
  if (actorId === post.uid) return true;
  const profile = await getUserProfileData(post.uid);
  const privacy = normalizePrivacy(profile);
  if (privacy.comments === "everyone") return true;
  if (privacy.comments === "nobody") return false;
  return isFollowing(actorId, post.uid);
}

export async function saveUserPrivacySettings(uid: string, privacy: UserPrivacySettings) {
  await setDoc(
    doc(db, "users", uid),
    {
      privacy,
      accountPrivacy: privacy.account,
      isPrivate: privacy.account === "private",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

function userFromDoc(userDoc: { id: string; data: () => DocumentData }): SearchableUser | null {
  const data = userDoc.data();
  const privacy = normalizePrivacy(data);
  if (!privacy.discoverable) return null;
  return {
    uid: userDoc.id,
    username: data.username || "",
    displayName: data.displayName || data.username || "Hivez User",
    photoURL: data.photoURL || "",
    verified: data.verified || false,
    bio: data.bio || "",
  };
}

async function runUserPrefixQuery(field: "usernameLower" | "displayNameLower", term: string, maxResults: number) {
  const snap = await getDocs(
    query(collection(db, "users"), orderBy(field), startAt(term), endAt(`${term}\uf8ff`), limit(maxResults))
  );
  return snap.docs.map(userFromDoc).filter(Boolean) as SearchableUser[];
}

export async function searchUsers(term: string, currentUserId?: string | null, maxResults = 12) {
  const normalized = cleanSearchText(term);
  if (!normalized) return [];

  const byId = new Map<string, SearchableUser>();

  try {
    const [usernameMatches, nameMatches] = await Promise.all([
      runUserPrefixQuery("usernameLower", normalized, maxResults),
      runUserPrefixQuery("displayNameLower", normalized, maxResults),
    ]);
    [...usernameMatches, ...nameMatches].forEach((candidate) => {
      if (candidate.uid !== currentUserId) byId.set(candidate.uid, candidate);
    });
  } catch {
    // Older profiles may not have search-normalized fields yet. The bounded
    // fallback keeps autocomplete useful without scanning the whole collection.
  }

  if (byId.size < Math.min(4, maxResults)) {
    const fallback = await getDocs(query(collection(db, "users"), limit(60)));
    fallback.docs.forEach((userDoc) => {
      if (byId.size >= maxResults) return;
      if (userDoc.id === currentUserId) return;
      const candidate = userFromDoc(userDoc);
      if (!candidate) return;
      const username = candidate.username.toLowerCase();
      const displayName = candidate.displayName.toLowerCase();
      if (username.includes(normalized) || displayName.includes(normalized)) {
        byId.set(candidate.uid, candidate);
      }
    });
  }

  // Blocked pairs stay hidden from each other in search suggestions.
  const visibleCandidates: SearchableUser[] = [];
  for (const candidate of byId.values()) {
    if (visibleCandidates.length >= maxResults) break;
    if (await isBlockedBetween(currentUserId, candidate.uid)) continue;
    visibleCandidates.push(candidate);
  }

  return visibleCandidates;
}
