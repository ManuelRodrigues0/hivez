import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import type { FeedPost } from "@/components/feed/Feed";
import { haversineKm, normalizeLocation, type GeoPointLike } from "@/services/location";

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export async function loadPostsInBounds(bounds: MapBounds, center?: GeoPointLike) {
  const southHash = `${Math.round((bounds.south + 90) * 100)}_`;
  const northHash = `${Math.round((bounds.north + 90) * 100) + 1}_\uf8ff`;
  const snap = await getDocs(
    query(
      collection(db, "posts"),
      where("locationSnapshot.geohash", ">=", southHash),
      where("locationSnapshot.geohash", "<=", northHash),
      orderBy("locationSnapshot.geohash"),
      limit(180),
    ),
  );

  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as FeedPost)
    .filter((post) => {
      const location = normalizeLocation(post.locationSnapshot);
      if (!location) return false;
      return location.latitude <= bounds.north && location.latitude >= bounds.south && location.longitude <= bounds.east && location.longitude >= bounds.west;
    })
    .map((post) => {
      const location = normalizeLocation(post.locationSnapshot);
      return { ...post, distanceKm: location && center ? haversineKm(center, location) : undefined };
    });
}
