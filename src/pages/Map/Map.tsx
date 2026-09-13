import { useEffect, useMemo, useRef, useState } from "react";
import { Compass, LocateFixed, MapPin, Minus, Plus, X } from "lucide-react";
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
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const bounds = useMemo(() => boundsFor(queryCenter, queryZoom), [queryCenter, queryZoom]);
  const tiles = useMemo(() => visibleTiles(center, zoom), [center, zoom]);

  useEffect(() => {
    if (params.get("lat") || params.get("lng") || userLocation.location) return;
    void userLocation.requestLocation().then((detected) => {
      if (!detected) return;
      setCenter(detected);
      setQueryCenter(detected);
    });
  }, [params, userLocation.location, userLocation.requestLocation]);

  useEffect(() => {
    const saved = localStorage.getItem("hivez.last-map-center");
    if (!saved || params.get("lat") || params.get("lng") || userLocation.location) return;
    try {
      const parsed = JSON.parse(saved) as GeoPointLike;
      if (Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) {
        setCenter(parsed);
        setQueryCenter(parsed);
      }
    } catch {
      localStorage.removeItem("hivez.last-map-center");
    }
  }, [params, userLocation.location]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem("hivez.last-map-center", JSON.stringify(center));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [center]);

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
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2) {
      const points = [...pointersRef.current.values()];
      pinchRef.current = { distance: distanceBetween(points[0], points[1]), zoom };
      dragRef.current = null;
      setDragging(false);
      return;
    }

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
      pointersRef.current.set(pointerEvent.pointerId, { x: pointerEvent.clientX, y: pointerEvent.clientY });
      if (pointersRef.current.size >= 2 && pinchRef.current) {
        const points = [...pointersRef.current.values()];
        const ratio = distanceBetween(points[0], points[1]) / Math.max(1, pinchRef.current.distance);
        setZoom(clamp(Math.round(pinchRef.current.zoom + Math.log2(ratio)), 4, 18));
        return;
      }
      updateDrag(pointerEvent.pointerId, pointerEvent.clientX, pointerEvent.clientY);
    };
    const end = (pointerEvent: PointerEvent) => {
      pointersRef.current.delete(pointerEvent.pointerId);
      if (pointersRef.current.size < 2) pinchRef.current = null;
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
    <div className="sticky top-0 h-[calc(100dvh-9.5rem)] min-h-[420px] overflow-hidden bg-zinc-100 dark:bg-zinc-950 lg:top-16 lg:h-[calc(100dvh-64px)] lg:min-h-[520px]">
      {/* Top Left Floating Actions */}
      <div className="absolute left-4 top-4 z-20 flex gap-2.5">
        <button 
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/90 text-zinc-700 shadow-lg backdrop-blur-md transition-all hover:bg-white hover:scale-105 active:scale-95 dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-900" 
          onClick={() => navigate(-1)} 
          aria-label="Close map"
        >
          <X size={18} />
        </button>
        <button 
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/90 text-zinc-700 shadow-lg backdrop-blur-md transition-all hover:bg-white hover:scale-105 active:scale-95 dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-900" 
          onClick={goToCurrentLocation} 
          aria-label="Current location"
        >
          <LocateFixed size={18} />
        </button>
      </div>

      {/* Top Right Zoom Controls */}
      <div className="absolute right-4 top-4 z-20 flex flex-col gap-2">
        <button 
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/90 text-zinc-700 shadow-lg backdrop-blur-md transition-all hover:bg-white hover:scale-105 active:scale-95 dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-900" 
          onClick={() => setZoom((z) => Math.min(18, z + 1))} 
          aria-label="Zoom in"
        >
          <Plus size={18} />
        </button>
        <button 
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200/80 bg-white/90 text-zinc-700 shadow-lg backdrop-blur-md transition-all hover:bg-white hover:scale-105 active:scale-95 dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:bg-zinc-900" 
          onClick={() => setZoom((z) => Math.max(4, z - 1))} 
          aria-label="Zoom out"
        >
          <Minus size={18} />
        </button>
      </div>

      {/* Map Pan / Drag Canvas */}
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
            className="absolute z-10 grid h-10 min-w-10 -translate-x-1/2 -translate-y-full place-items-center rounded-2xl border-2 border-white bg-amber-400 px-3 text-xs font-black text-zinc-950 shadow-xl transition-transform hover:scale-110 active:scale-95 dark:border-zinc-900"
            style={{ left: cluster.x, top: cluster.y }}
            aria-label={`${cluster.posts.length} posts`}
          >
            {cluster.posts.length > 1 ? cluster.posts.length : <MapPin size={18} />}
          </button>
        ))}
      </div>

      {/* Bottom Directional Panning Toolbar */}
      <div className="absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-2xl border border-zinc-200/80 bg-white/90 p-1.5 shadow-xl backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/90 lg:bottom-6">
        <button className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" onClick={() => pan(0, 0.2)}>North</button>
        <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
        <button className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" onClick={() => pan(-0.2, 0)}>West</button>
        <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
        <button className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" onClick={() => pan(0.2, 0)}>East</button>
        <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
        <button className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" onClick={() => pan(0, -0.2)}>South</button>
      </div>

      {loading && (
        <div className="absolute inset-x-0 top-20 z-20 flex justify-center pointer-events-none">
          <div className="rounded-2xl border border-zinc-200/60 bg-white/90 px-4 py-2 shadow-lg backdrop-blur-md dark:border-zinc-800/60 dark:bg-zinc-900/90">
            <HivezLoader size="sm" label="Loading nearby posts" />
          </div>
        </div>
      )}

      {selected && <PostPreview post={selected} onClose={() => setSelected(null)} onOpen={() => navigate(`/post/${selected.id}`)} />}
    </div>
  );
}

function PostPreview({ post, onClose, onOpen }: { post: FeedPost; onClose: () => void; onOpen: () => void }) {
  const location = normalizeLocation(post.locationSnapshot);
  return (
    <div className="absolute inset-x-4 bottom-20 z-30 mx-auto max-w-md rounded-3xl border border-zinc-200/80 bg-white/95 p-5 shadow-2xl backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-900/95 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-full bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
            {post.category || "Community"}
          </span>
          <h2 className="mt-2 line-clamp-2 text-sm font-bold text-zinc-900 dark:text-white">{post.caption || "Local report"}</h2>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <MapPin size={13} className="shrink-0" />
            <span className="truncate">{locationLabel(location, post.location)}</span>
            {typeof post.distanceKm === "number" ? <span className="shrink-0">· {formatDistance(post.distanceKm)}</span> : ""}
          </p>
        </div>
        {post.mediaUrl && <img src={post.mediaUrl} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-md" />}
        <button 
          onClick={onClose} 
          className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Close preview"
        >
          <X size={16} />
        </button>
      </div>
      <button 
        onClick={onOpen} 
        className="mt-4 w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-extrabold text-white shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] dark:bg-white dark:text-zinc-950"
      >
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

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}