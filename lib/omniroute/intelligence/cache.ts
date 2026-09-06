/**
 * Small in-memory TTL cache for semantic intelligence results.
 *
 * Keyed by normalized query + registry version so entries invalidate
 * automatically whenever the Hive registry changes. Never stores secrets or
 * sensitive user data - only normalized queries and hive-level results.
 */

import { CACHE_SETTINGS } from "../config.js";

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

/** Builds a stable cache key from the parts. */
export function cacheKey(...parts: (string | number | boolean | null | undefined)[]): string {
  return parts.map((part) => (part === null || part === undefined ? "" : String(part))).join("::");
}

/** Stable hash of the registry used for cache versioning. */
export function registryVersion(registry: { id: string; name: string; aliases?: string[]; keywords?: string[] }[]): string {
  const canonical = registry
    .map((hive) => `${hive.id}|${hive.name}|${(hive.aliases ?? []).join(",")}|${(hive.keywords ?? []).join(",")}`)
    .sort()
    .join(";");
  let hash = 0;
  for (let index = 0; index < canonical.length; index++) {
    hash = (hash * 31 + canonical.charCodeAt(index)) | 0;
  }
  return String(hash);
}

/** Returns the cached value or null when absent/expired. */
export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  // Refresh recency for simple eviction.
  store.delete(key);
  store.set(key, entry);
  return entry.value as T;
}

/** Stores a value under the key with the configured TTL. */
export function setCached(key: string, value: unknown): void {
  if (store.size >= CACHE_SETTINGS.maxEntries) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + CACHE_SETTINGS.ttlMs });
}

/** Test hook: clears all cached entries. */
export function clearCacheForTests(): void {
  store.clear();
}
