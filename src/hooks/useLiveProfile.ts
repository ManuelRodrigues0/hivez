/**
 * Real-time profile hooks built on the shared profileCache registry.
 *
 * These hooks never open more than one Firestore listener per user id
 * (handled by the registry), so they are safe to use per rendered card/row.
 */

import { useEffect, useMemo, useState } from "react";

import { getCachedProfile, subscribeProfile, type LiveProfile } from "@/services/profileCache";
import type { VolunteerUserSummary } from "@/types/volunteering";

/**
 * Live profile for a user id. While the live data loads (or if the profile
 * cannot be read) the provided fallback snapshot is returned instead, so
 * existing UI keeps working with zero flicker.
 */
export function useLiveProfile<T = Record<string, any>>(
  uid: string | null | undefined,
  fallback?: T | null
): LiveProfile | null {
  const [profile, setProfile] = useState<LiveProfile | null>(() =>
    uid ? getCachedProfile(uid) : null
  );

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    return subscribeProfile(uid, setProfile);
  }, [uid]);

  if (!uid) return null;
  if (!profile) return (fallback as LiveProfile) ?? null;
  // Live data wins; fallback fills anything the profile doc doesn't have.
  return { ...(fallback as Record<string, any>), ...profile };
}

/**
 * Live profiles for a list of user ids (e.g. search results, chat
 * participants, community members). One shared listener per id.
 */
export function useLiveProfiles(uids: string[]): Record<string, LiveProfile> {
  const key = useMemo(() => [...new Set(uids)].sort().join("|"), [uids]);
  const [profiles, setProfiles] = useState<Record<string, LiveProfile>>(() => {
    const initial: Record<string, LiveProfile> = {};
    uids.forEach((uid) => {
      const cached = getCachedProfile(uid);
      if (cached) initial[uid] = cached;
    });
    return initial;
  });

  useEffect(() => {
    const idList = key ? key.split("|") : [];
    const unsubs = idList.map((uid) =>
      subscribeProfile(uid, (profile) => {
        setProfiles((current) => {
          if (profile) {
            if (current[uid] === profile) return current;
            return { ...current, [uid]: profile };
          }
          if (!(uid in current)) return current;
          const next = { ...current };
          delete next[uid];
          return next;
        });
      })
    );
    return () => unsubs.forEach((unsubscribe) => unsubscribe());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return profiles;
}

/**
 * Live VolunteerUserSummary for the signed-in user, used by the volunteering
 * flows when writing membership/participant docs so stored user snapshots are
 * always fresh instead of stale one-time reads.
 */
export function useLiveUserSummary(uid: string | null | undefined): VolunteerUserSummary | null {
  const profile = useLiveProfile(uid);
  if (!uid || !profile) return null;
  return {
    uid,
    username: profile.username || "",
    displayName: profile.displayName || profile.username || "Hivez User",
    photoURL: profile.photoURL || "",
  };
}
