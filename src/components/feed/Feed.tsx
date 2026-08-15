import { useEffect, useState } from "react";

import HivezLoader from "../common/HivezLoader";
import FeedCard from "./FeedCard";
import type { PostMediaItem } from "./MediaGrid";
import { useAuth } from "@/context/AuthContext";
import { useUserLocation } from "@/context/LocationContext";
import { loadRankedFeed } from "@/services/feedRanking";
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
  }, [category, hashtag, location, user?.uid]);

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
