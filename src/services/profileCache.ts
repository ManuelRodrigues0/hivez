/**
 * Shared real-time profile cache.
 *
 * Single source of truth for live user profile data across the app. Components
 * subscribe through this registry instead of opening their own onSnapshot
 * listeners, so no matter how many components display the same user, only ONE
 * Firestore listener exists per user id while it is actually displayed.
 *
 * - Reference counted: each subscriber adds a ref; when the last ref goes away
 *   the underlying listener is closed after a short grace period (avoids
 *   listener churn while navigating between pages).
 * - Deduplicated notifications: listeners are only notified when the profile
 *   data actually changed (shallow compare), preventing render loops.
 * - Fails soft: a missing/permission-blocked user doc simply resolves to null
 *   so callers keep rendering their stored snapshot data.
 */

import { doc, onSnapshot } from "firebase/firestore";

import { db } from "@/firebase/firebase";

export interface LiveProfile {
  uid: string;
  displayName?: string;
  username?: string;
  photoURL?: string;
  bannerURL?: string;
  bio?: string;
  verified?: boolean;
  profileCompleted?: boolean;
  followers?: number;
  following?: number;
  posts?: number;
  [key: string]: any;
}

type ProfileListener = (profile: LiveProfile | null) => void;

interface CacheEntry {
  refs: number;
  unsubscribe: (() => void) | null;
  data: LiveProfile | null;
  loaded: boolean;
  listeners: Set<ProfileListener>;
  closeTimer: number | null;
}

/** How long an unused profile listener stays open before it is closed. */
const GRACE_PERIOD_MS = 30_000;

const registry = new Map<string, CacheEntry>();

function shallowEqualProfiles(a: LiveProfile | null, b: LiveProfile | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}

function startListener(uid: string, entry: CacheEntry) {
  entry.unsubscribe = onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      const next = snap.exists() ? ({ uid: snap.id, ...snap.data() } as LiveProfile) : null;
      if (entry.loaded && shallowEqualProfiles(entry.data, next)) return;
      entry.data = next;
      entry.loaded = true;
      entry.listeners.forEach((listener) => listener(next));
    },
    (error) => {
      // Missing/inaccessible profiles resolve to null - callers fall back to
      // their stored snapshot data. Never break the UI for this.
      console.error(`Profile listener failed for ${uid}:`, error);
      if (!entry.loaded) {
        entry.loaded = true;
        entry.data = null;
        entry.listeners.forEach((listener) => listener(null));
      }
    }
  );
}

export function getCachedProfile(uid: string | null | undefined): LiveProfile | null {
  if (!uid) return null;
  return registry.get(uid)?.data ?? null;
}

/**
 * Subscribe to a user's live profile. Returns an unsubscribe function.
 * The first callback fires synchronously when data is already cached.
 */
export function subscribeProfile(uid: string | null | undefined, listener: ProfileListener): () => void {
  if (!uid) {
    listener(null);
    return () => {};
  }

  let entry = registry.get(uid);
  if (!entry) {
    entry = {
      refs: 0,
      unsubscribe: null,
      data: null,
      loaded: false,
      listeners: new Set(),
      closeTimer: null,
    };
    registry.set(uid, entry);
  }

  if (entry.closeTimer !== null) {
    window.clearTimeout(entry.closeTimer);
    entry.closeTimer = null;
  }

  entry.refs += 1;
  entry.listeners.add(listener);

  if (!entry.unsubscribe) {
    startListener(uid, entry);
  }
  if (entry.loaded) {
    listener(entry.data);
  }

  return () => {
    entry.refs -= 1;
    entry.listeners.delete(listener);
    if (entry.refs <= 0 && entry.closeTimer === null) {
      entry.closeTimer = window.setTimeout(() => {
        entry.unsubscribe?.();
        entry.unsubscribe = null;
        registry.delete(uid);
      }, GRACE_PERIOD_MS);
    }
  };
}
