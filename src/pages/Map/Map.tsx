import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, MapPin, Minus, Plus, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import HivezLoader from "@/components/common/HivezLoader";
import type { FeedPost } from "@/components/feed/Feed";
import { useUserLocation } from "@/context/LocationContext";
import { loadPostsInBounds } from "@/services/mapPosts";
import { formatDistance, locationLabel, normalizeLocation, type GeoPointLike } from "@/services/location";

const TILE_SIZE = 256;

export default function MapPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const userLocation = useUserLocation();
  const initialCenter = useMemo(() => {
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
    return userLocation.location || { latitude: 19.076, longitude: 72.8777 };
  }, [params, userLocation.location]);
  const [center, setCenter] = useState<GeoPointLike>(initialCenter);
  const [queryCenter, setQueryCenter] = useState<GeoPointLike>(initialCenter);
  const [zoom, setZoom] = useState(params.get("post") ? 15 : 13);
  const [queryZoom, setQueryZoom] = useState(params.get("post") ? 15 : 13);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [selected, setSelected] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    centerWorld: { x: number; y: number };
  } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const bounds = useMemo(() => boundsFor(queryCenter, queryZoom), [queryCenter, queryZoom]);
  const tiles = useMemo(() => visibleTiles(center, zoom), [center, zoom]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQueryCenter(center);
      setQueryZoom(zoom);
    }, dragging ? 450 : 160);

    return () => window.clearTimeout(timer);
  }, [center, dragging, zoom]);

  useEffect(() => {
    let active = true;
    loadPostsInBounds(bounds, queryCenter)
      .then((next) => {
        if (!active) return;
        setPosts(next);
        const selectedId = params.get("post");
        if (selectedId) setSelected(next.find((post) => post.id === selectedId) || null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [bounds, params, queryCenter]);

  async function goToCurrentLocation() {
    const detected = await userLocation.requestLocation();
    if (detected) {
      setCenter(detected);
      setQueryCenter(detected);
      setZoom(14);
      setQueryZoom(14);
    }
  }

  function pan(dx: number, dy: number) {
    const scale = 360 / 2 ** zoom;
    setCenter((current) => ({
      latitude: clamp(current.latitude + dy * scale, -85, 85),
      longitude: wrap(current.longitude + dx * scale),
    }));
  }

  useEffect(
    () => () => {
      dragCleanupRef.current?.();
      if (dragFrameRef.current) window.cancelAnimationFrame(dragFrameRef.current);
    },
    [],
  );

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      centerWorld: lonLatToWorld(center.longitude, center.latitude, zoom),
    };
    setDragging(true);

    const move = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault();
      updateDrag(pointerEvent.pointerId, pointerEvent.clientX, pointerEvent.clientY);
    };
    const end = (pointerEvent: PointerEvent) => {
      stopDrag(pointerEvent.pointerId);
    };

    dragCleanupRef.current?.();
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    dragCleanupRef.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      dragCleanupRef.current = null;
    };
  }

  function updateDrag(pointerId: number, clientX: number, clientY: number) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;

    const nextWorld = {
      x: drag.centerWorld.x - (clientX - drag.startX),
      y: drag.centerWorld.y - (clientY - drag.startY),
    };
    const nextCenter = worldToLonLat(nextWorld.x, nextWorld.y, zoom);
    if (dragFrameRef.current) window.cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = window.requestAnimationFrame(() => {
      setCenter({ latitude: nextCenter.latitude, longitude: nextCenter.longitude });
    });
  }

  function stopDrag(pointerId: number) {
    if (dragRef.current?.pointerId !== pointerId) return;
    dragRef.current = null;
    dragCleanupRef.current?.();
    setDragging(false);
  }

  return (
    <div className="sticky top-0 h-[calc(100dvh-104px)] min-h-[520px] overflow-hidden bg-zinc-100 dark:bg-zinc-950 lg:top-16 lg:h-[calc(100dvh-64px)]">
      <div className="absolute left-4 top-4 z-20 flex gap-2">
        <button className="app-icon-button bg-white/90 dark:bg-zinc-900/90" onClick={() => navigate(-1)} aria-label="Close map">
          <X size={18} />
        </button>
        <button className="app-icon-button bg-white/90 dark:bg-zinc-900/90" onClick={goToCurrentLocation} aria-label="Current location">
          <LocateFixed size={18} />
        </button>
      </div>

      <div className="absolute right-4 top-4 z-20 grid gap-2">
        <button className="app-icon-button bg-white/90 dark:bg-zinc-900/90" onClick={() => setZoom((z) => Math.min(18, z + 1))} aria-label="Zoom in">
          <Plus size={18} />
        </button>
        <button className="app-icon-button bg-white/90 dark:bg-zinc-900/90" onClick={() => setZoom((z) => Math.max(4, z - 1))} aria-label="Zoom out">
          <Minus size={18} />
        </button>
      </div>

      <div
        className={`absolute inset-0 touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={startDrag}
        onWheel={(event) => setZoom((z) => clamp(z + (event.deltaY < 0 ? 1 : -1), 4, 18))}
      >
        {tiles.map((tile) => (
          <img
            key={`${tile.z}-${tile.x}-${tile.y}`}
            src={`https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`}
            alt=""
            className="absolute h-64 w-64 select-none"
            style={{ left: tile.left, top: tile.top }}
            draggable={false}
          />
        ))}

        {userLocation.location && (
          <Marker point={project(userLocation.location, center, zoom)} className="bg-sky-500 ring-sky-500/30" label="You" />
        )}

        {clusterPosts(posts, center, zoom).map((cluster) => (
          <button
            key={cluster.id}
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => (cluster.posts.length === 1 ? setSelected(cluster.posts[0]) : setZoom((z) => Math.min(18, z + 2)))}
            className="absolute z-10 grid h-9 min-w-9 -translate-x-1/2 -translate-y-full place-items-center rounded-full border border-white bg-amber-400 px-2 text-xs font-black text-black shadow-lg"
            style={{ left: cluster.x, top: cluster.y }}
            aria-label={`${cluster.posts.length} posts`}
          >
            {cluster.posts.length > 1 ? cluster.posts.length : <MapPin size={17} />}
          </button>
        ))}
      </div>

      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        <button className="rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-zinc-700 shadow dark:bg-zinc-900/90 dark:text-zinc-200" onClick={() => pan(0, 0.2)}>North</button>
        <button className="rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-zinc-700 shadow dark:bg-zinc-900/90 dark:text-zinc-200" onClick={() => pan(-0.2, 0)}>West</button>
        <button className="rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-zinc-700 shadow dark:bg-zinc-900/90 dark:text-zinc-200" onClick={() => pan(0.2, 0)}>East</button>
        <button className="rounded-full bg-white/90 px-3 py-2 text-xs font-semibold text-zinc-700 shadow dark:bg-zinc-900/90 dark:text-zinc-200" onClick={() => pan(0, -0.2)}>South</button>
      </div>

      {loading && <div className="absolute inset-x-0 top-20 z-20 flex justify-center"><HivezLoader size="sm" label="Loading nearby posts" /></div>}
      {selected && <PostPreview post={selected} onClose={() => setSelected(null)} onOpen={() => navigate(`/post/${selected.id}`)} />}
    </div>
  );
}

function PostPreview({ post, onClose, onOpen }: { post: FeedPost; onClose: () => void; onOpen: () => void }) {
  const location = normalizeLocation(post.locationSnapshot);
  return (
    <div className="absolute inset-x-3 bottom-20 z-30 mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{post.category || "Community"}</p>
          <h2 className="mt-1 line-clamp-2 text-sm font-bold text-zinc-900 dark:text-white">{post.caption || "Local report"}</h2>
          <p className="mt-2 text-xs text-zinc-500">
            {locationLabel(location, post.location)}
            {typeof post.distanceKm === "number" ? ` · ${formatDistance(post.distanceKm)}` : ""}
          </p>
        </div>
        {post.mediaUrl && <img src={post.mediaUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />}
        <button onClick={onClose} className="rounded-full p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={16} /></button>
      </div>
      <button onClick={onOpen} className="mt-4 w-full rounded-full bg-zinc-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-black">
        Open Post
      </button>
    </div>
  );
}

function Marker({ point, className, label }: { point: { x: number; y: number }; className: string; label: string }) {
  return <div className={`absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-8 ${className}`} style={{ left: point.x, top: point.y }} aria-label={label} />;
}

function clusterPosts(posts: FeedPost[], center: GeoPointLike, zoom: number) {
  const buckets = new Map<string, { id: string; x: number; y: number; posts: FeedPost[] }>();
  posts.forEach((post) => {
    const location = normalizeLocation(post.locationSnapshot);
    if (!location) return;
    const point = project(location, center, zoom);
    const key = `${Math.round(point.x / 44)}_${Math.round(point.y / 44)}`;
    const bucket = buckets.get(key) || { id: key, x: point.x, y: point.y, posts: [] };
    bucket.posts.push(post);
    buckets.set(key, bucket);
  });
  return [...buckets.values()];
}

function visibleTiles(center: GeoPointLike, zoom: number) {
  const centerWorld = lonLatToWorld(center.longitude, center.latitude, zoom);
  const viewport = { width: window.innerWidth, height: Math.max(640, window.innerHeight - 64) };
  const startX = Math.floor((centerWorld.x - viewport.width / 2) / TILE_SIZE) - 1;
  const endX = Math.floor((centerWorld.x + viewport.width / 2) / TILE_SIZE) + 1;
  const startY = Math.floor((centerWorld.y - viewport.height / 2) / TILE_SIZE) - 1;
  const endY = Math.floor((centerWorld.y + viewport.height / 2) / TILE_SIZE) + 1;
  const max = 2 ** zoom;
  const tiles = [];
  for (let x = startX; x <= endX; x += 1) {
    for (let y = startY; y <= endY; y += 1) {
      if (y < 0 || y >= max) continue;
      tiles.push({ z: zoom, x: ((x % max) + max) % max, y, left: x * TILE_SIZE - centerWorld.x + viewport.width / 2, top: y * TILE_SIZE - centerWorld.y + viewport.height / 2 });
    }
  }
  return tiles;
}

function project(point: GeoPointLike, center: GeoPointLike, zoom: number) {
  const world = lonLatToWorld(point.longitude, point.latitude, zoom);
  const centerWorld = lonLatToWorld(center.longitude, center.latitude, zoom);
  return { x: world.x - centerWorld.x + window.innerWidth / 2, y: world.y - centerWorld.y + Math.max(640, window.innerHeight - 64) / 2 };
}

function boundsFor(center: GeoPointLike, zoom: number) {
  const latSpan = 80 / 2 ** (zoom - 4);
  const lonSpan = 120 / 2 ** (zoom - 4);
  return { north: clamp(center.latitude + latSpan, -85, 85), south: clamp(center.latitude - latSpan, -85, 85), east: wrap(center.longitude + lonSpan), west: wrap(center.longitude - lonSpan) };
}

function lonLatToWorld(lon: number, lat: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((clamp(lat, -85.0511, 85.0511) * Math.PI) / 180);
  return { x: ((lon + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

function worldToLonLat(x: number, y: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const lon = wrap((x / scale) * 360 - 180);
  const mercator = Math.PI * (1 - (2 * y) / scale);
  const lat = (Math.atan(Math.sinh(mercator)) * 180) / Math.PI;
  return { latitude: clamp(lat, -85, 85), longitude: lon };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrap(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}
