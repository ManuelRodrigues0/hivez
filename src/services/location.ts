import type { DocumentData } from "firebase/firestore";

export type LocationStatus =
  | "idle"
  | "detecting"
  | "granted"
  | "denied"
  | "unavailable"
  | "timeout"
  | "unsupported"
  | "manual";

export interface GeoPointLike {
  latitude: number;
  longitude: number;
}

export interface LocationSnapshot extends GeoPointLike {
  accuracy?: number;
  address?: string;
  area?: string;
  city?: string;
  state?: string;
  country?: string;
  timestamp?: number;
  geohash?: string;
}

export interface UserLocationState {
  status: LocationStatus;
  location: LocationSnapshot | null;
  error?: string;
}

export function isValidCoordinate(latitude: unknown, longitude: unknown): latitude is number {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function normalizeLocation(input: unknown): LocationSnapshot | null {
  if (!input || typeof input !== "object") return null;
  const data = input as DocumentData;
  const latitude = data.latitude;
  const longitude = data.longitude;
  if (!isValidCoordinate(latitude, longitude)) return null;

  return {
    latitude,
    longitude,
    accuracy: typeof data.accuracy === "number" ? data.accuracy : undefined,
    address: typeof data.address === "string" ? data.address : undefined,
    area: typeof data.area === "string" ? data.area : undefined,
    city: typeof data.city === "string" ? data.city : undefined,
    state: typeof data.state === "string" ? data.state : undefined,
    country: typeof data.country === "string" ? data.country : undefined,
    timestamp: typeof data.timestamp === "number" ? data.timestamp : undefined,
    geohash: typeof data.geohash === "string" ? data.geohash : encodeGeoHash(latitude, longitude),
  };
}

export function createLocationSnapshot(input: LocationSnapshot): LocationSnapshot {
  if (!isValidCoordinate(input.latitude, input.longitude)) {
    throw new Error("Invalid location coordinates.");
  }

  return {
    latitude: input.latitude,
    longitude: input.longitude,
    accuracy: input.accuracy,
    address: input.address?.trim() || undefined,
    area: input.area?.trim() || undefined,
    city: input.city?.trim() || undefined,
    state: input.state?.trim() || undefined,
    country: input.country?.trim() || undefined,
    timestamp: input.timestamp || Date.now(),
    geohash: input.geohash || encodeGeoHash(input.latitude, input.longitude),
  };
}

export function encodeGeoHash(latitude: number, longitude: number) {
  const lat = Math.round((latitude + 90) * 100);
  const lng = Math.round((longitude + 180) * 100);
  return `${lat}_${lng}`;
}

export function haversineKm(a: GeoPointLike, b: GeoPointLike) {
  const radiusKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radiusKm * Math.asin(Math.sqrt(h));
}

export function locationLabel(location: LocationSnapshot | null | undefined, fallback?: string | null) {
  if (!location) return fallback || "";
  return [location.area, location.city].filter(Boolean).join(", ") || location.address || fallback || "Pinned location";
}

export function formatDistance(km: number | null | undefined) {
  if (typeof km !== "number" || !Number.isFinite(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

export async function detectBrowserLocation(): Promise<LocationSnapshot> {
  if (!("geolocation" in navigator)) {
    throw Object.assign(new Error("This browser does not support location."), { code: "unsupported" });
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(
          createLocationSnapshot({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          }),
        );
      },
      (error) => {
        const code = error.code === error.PERMISSION_DENIED ? "denied" : error.code === error.TIMEOUT ? "timeout" : "unavailable";
        reject(Object.assign(new Error(error.message), { code }));
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 120000 },
    );
  });
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}
