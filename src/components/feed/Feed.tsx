import { useEffect, useRef, useState } from "react";
import { onSnapshot } from "firebase/firestore";

import HivezLoader from "../common/HivezLoader";
import FeedCard from "./FeedCard";
import type { PostMediaItem } from "./MediaGrid";
import { useAuth } from "@/context/AuthContext";
import { useUserLocation } from "@/context/LocationContext";
import {
  loadRankedFeed,
  loadFeedBundle,
  rankFeedPosts,
  recentPostsQuery,
  type FeedContextBundle,
} from "@/services/feedRanking";
import type { LocationSnapshot } from "@/services/location";

export interface FeedPost {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  verified: boolean;
  caption: string;
  mediaUrl: string;
  mediaUrls?: string[];
  mediaItems?: PostMediaItem[];
  mediaType: "image" | "video" | "text";
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
  views?: number;
  impressions?: number;
  confirmations?: number;
  urgency?: number;
  createdAt: any;
  category?: string;
  hashtags?: string[];
  location?: string | null;
  locationSnapshot?: LocationSnapshot | null;
  distanceKm?: number | null;
  issueCommunityId?: string;
}

interface FeedProps {
  category?: string;
  hashtag?: string;
  onCommentClick?: (post: FeedPost) => void;
}

export default function Feed({ category, hashtag, onCommentClick }: FeedProps) {
  const { user } = useAuth();
  const { location } = useUserLocation();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Ranking context reused to rank newly arriving posts without extra reads.
  const bundleRef = useRef<FeedContextBundle | null>(null);
  const postsRef = useRef<FeedPost[]>([]);
  const rerankTimerRef = useRef<number | null>(null);

  const contextKey = [
    category || "",
    hashtag || "",
    user?.uid || "",
    location?.latitude ?? "",
    location?.longitude ?? "",
  ].join("|");

  // Initial ranked load (existing ranking pipeline, unchanged behaviour).
  useEffect(() => {
    let active = true;
    setLoading(true);

    loadRankedFeed({ uid: user?.uid, location, category, hashtag })
      .then((data) => {
        if (!active) return;
        setPosts(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  // Ranking bundle for incremental ranking of new posts. Firestore dedupes the
  // identical queries issued by the initial load, so this adds no extra reads.
  useEffect(() => {
    let active = true;
    loadFeedBundle({ uid: user?.uid, location, category, hashtag }).then((result) => {
      if (!active) return;
      bundleRef.current = result.bundle;
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextKey]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // Real-time layer: ONE listener for the whole feed keeps it live.
  // - edited posts  -> patched in place (ranked position preserved, no flicker)
  // - deleted posts -> removed automatically
  // - new posts     -> merged in with a light local re-rank (debounced, zero extra reads)
  useEffect(() => {
    const matchesFeed = (post: FeedPost) =>
      !hashtag ||
      post.hashtags?.some((tag) => tag.toLowerCase() === hashtag.toLowerCase());

    const unsubscribe = onSnapshot(
      recentPostsQuery(category),
      (snapshot) => {
        const live = snapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        })) as FeedPost[];

        const liveById = new Map(live.map((post) => [post.id, post]));
        const current = postsRef.current;
        const currentIds = new Set(current.map((post) => post.id));

        // Patch existing posts with fresh data (keeps their ranked position).
        const next: FeedPost[] = [];
        current.forEach((post) => {
          const fresh = liveById.get(post.id);
          if (!fresh) return; // deleted -> disappears without refresh
          next.push({ ...post, ...fresh });
        });
        setPosts(next);
        postsRef.current = next;

        const hasNewPosts = live.some((post) => !currentIds.has(post.id) && matchesFeed(post));

        if (hasNewPosts && bundleRef.current) {
          if (rerankTimerRef.current) window.clearTimeout(rerankTimerRef.current);
          rerankTimerRef.current = window.setTimeout(() => {
            rerankTimerRef.current = null;
            const bundle = bundleRef.current;
            if (!bundle) return;
            // The snapshot already holds every candidate post, so re-ranking is
            // computed locally - no additional Firestore reads.
            const ranked = rankFeedPosts(live, bundle);
            setPosts(ranked);
            postsRef.current = ranked;
          }, 900);
        }
      },
      (error) => {
        console.error("Feed listener failed:", error);
      }
    );

    return () => {
      if (rerankTimerRef.current) {
        window.clearTimeout(rerankTimerRef.current);
        rerankTimerRef.current = null;
      }
      unsubscribe();
    };
  }, [category, hashtag]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <HivezLoader size="md" progress={58} label="Loading posts" />
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="py-20 text-center text-zinc-500 dark:text-zinc-400">
        {category
          ? "No posts in this Hive yet."
          : hashtag
          ? `No posts with #${hashtag} yet.`
          : "No posts yet."}
      </div>
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <FeedCard
          key={post.id}
          post={post}
          onCommentClick={onCommentClick}
        />
      ))}
    </div>
  );
}
