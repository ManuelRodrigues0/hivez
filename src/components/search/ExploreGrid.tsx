/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BadgeCheck, Heart, Image as ImageIcon, Layers, MessageCircle, Play, Repeat2, Sparkles } from "lucide-react";
import { onSnapshot } from "firebase/firestore";

import HivezLoader from "@/components/common/HivezLoader";
import type { FeedPost } from "@/components/feed/Feed";
import { useAuth } from "@/context/AuthContext";
import { useUserLocation } from "@/context/LocationContext";
import { useLiveProfiles } from "@/hooks/useLiveProfile";
import {
  loadFeedBundle,
  rankFeedPosts,
  recentPostsQuery,
  type FeedContextBundle,
} from "@/services/feedRanking";
import { filterVisiblePosts } from "@/services/privacy";

function mediaFor(post: FeedPost) {
  const item = post.mediaItems?.[0];
  if (item) return item;
  const url = post.mediaUrls?.[0] || post.mediaUrl;
  if (!url) return null;
  return { url, type: post.mediaType === "video" ? "video" : "image" } as const;
}

export default function ExploreGrid() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { location } = useUserLocation();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [brokenMedia, setBrokenMedia] = useState<Record<string, boolean>>({});
  const bundleRef = useRef<FeedContextBundle | null>(null);

  const authorIds = useMemo(() => [...new Set(posts.map((post) => post.uid).filter(Boolean))].slice(0, 60), [posts]);
  const liveProfiles = useLiveProfiles(authorIds);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    loadFeedBundle({ uid: user?.uid, location })
      .then(async ({ bundle, recent }) => {
        if (!active) return;
        bundleRef.current = bundle;
        const visible = await filterVisiblePosts(user?.uid, recent);
        if (!active) return;
        setPosts(rankFeedPosts(visible, bundle).slice(0, 60));
      })
      .catch((err) => {
        console.error("Explore load failed:", err);
        if (active) setError("Explore could not load right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [location, user?.uid]);

  useEffect(() => {
    let active = true;
    const unsubscribe = onSnapshot(
      recentPostsQuery(),
      async (snapshot) => {
        const bundle = bundleRef.current;
        if (!bundle) return;
        const live = snapshot.docs.map((postDoc) => ({ id: postDoc.id, ...(postDoc.data() as Omit<FeedPost, "id">) }));
        const visible = await filterVisiblePosts(user?.uid, live);
        if (!active) return;
        setPosts(rankFeedPosts(visible, bundle).slice(0, 60));
      },
      (err) => {
        console.error("Explore listener failed:", err);
        if (active) setError("Explore updates are temporarily unavailable.");
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <HivezLoader size="md" progress={58} label="Loading Explore" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center text-zinc-500 dark:text-zinc-400">
        <Sparkles size={30} className="mb-3 text-[#3d654c] dark:text-[#f2c14e]" />
        <p className="text-sm font-bold text-zinc-900 dark:text-white">{error}</p>
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center px-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1c1d1a]/10 bg-white dark:border-neutral-800 dark:bg-[#121212]">
          <ImageIcon size={20} className="text-[#3d654c] dark:text-[#f2c14e]" />
        </div>
        <h2 className="mt-3 text-sm font-black text-[#1c1d1a] dark:text-white">No Explore posts yet</h2>
        <p className="mt-1 max-w-xs text-xs text-[#1c1d1a]/60 dark:text-neutral-400">
          Public posts with real Hivez activity will appear here as the community publishes.
        </p>
      </div>
    );
  }

  return (
    <div className="px-2 pb-24 pt-2 sm:px-4">
      <div className="grid auto-rows-[124px] grid-cols-3 gap-1.5 sm:auto-rows-[180px] sm:gap-2 lg:auto-rows-[210px]">
        {posts.map((post, index) => {
          const media = mediaFor(post);
          const author = liveProfiles[post.uid];
          const isLarge = index % 11 === 0 || index % 11 === 6;
          const hasMultiple = (post.mediaItems?.length || post.mediaUrls?.length || 0) > 1;
          const mediaBroken = brokenMedia[post.id];

          return (
            <button
              key={post.id}
              type="button"
              onClick={() => navigate(`/post/${post.id}`)}
              className={`group relative min-w-0 overflow-hidden rounded-lg border border-[#1c1d1a]/5 bg-white text-left shadow-2xs transition hover:border-[#3d654c]/30 focus:outline-none focus:ring-2 focus:ring-[#3d654c]/30 dark:border-neutral-800/80 dark:bg-[#121212] dark:focus:ring-[#f2c14e]/30 ${
                isLarge ? "col-span-2 row-span-2" : ""
              }`}
              aria-label={`Open post by ${author?.username || post.username || "Hivez user"}`}
            >
              {media && !mediaBroken ? (
                media.type === "video" ? (
                  <video
                    src={media.url}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    muted
                    playsInline
                    preload="metadata"
                    disablePictureInPicture
                    onError={() => setBrokenMedia((current) => ({ ...current, [post.id]: true }))}
                  />
                ) : (
                  <img
                    src={media.url}
                    alt={post.caption || "Hivez post media"}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={() => setBrokenMedia((current) => ({ ...current, [post.id]: true }))}
                  />
                )
              ) : (
                <div className="flex h-full w-full flex-col justify-between bg-[#f7f7f2] p-3 dark:bg-[#181818]">
                  <p className="line-clamp-5 text-[11px] font-semibold leading-snug text-[#1c1d1a]/80 dark:text-neutral-200 sm:text-xs">
                    {post.caption || "Community update"}
                  </p>
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#3d654c] dark:text-[#f2c14e]">
                    Text Post
                  </span>
                </div>
              )}

              <div className="absolute left-2 top-2 flex items-center gap-1">
                {media?.type === "video" && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-black/65 text-white backdrop-blur-xs">
                    <Play size={11} className="fill-white" />
                  </span>
                )}
                {hasMultiple && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-black/65 text-white backdrop-blur-xs">
                    <Layers size={11} />
                  </span>
                )}
              </div>

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                <div className="flex min-w-0 items-center gap-1.5">
                  <img
                    src={author?.photoURL || post.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=3d654c&color=fff"}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                    loading="lazy"
                  />
                  <span className="min-w-0 truncate text-[10px] font-bold text-white">@{author?.username || post.username || "user"}</span>
                  {(author?.verified || post.verified) && <BadgeCheck size={12} className="shrink-0 text-sky-300" />}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] font-bold text-white/90">
                  <span className="inline-flex items-center gap-1">
                    <Heart size={11} className="fill-white" /> {post.likes || 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle size={11} /> {post.comments || 0}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Repeat2 size={11} /> {post.reHives || 0}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
