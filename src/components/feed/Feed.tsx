import { useEffect, useState } from "react";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";

import FeedCard from "./FeedCard";

export interface FeedPost {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  verified: boolean;
  caption: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  likes: number;
  comments: number;
  shares: number;
  createdAt: any;
  category?: string;
  hashtags?: string[];
  location?: string | null;
}

interface FeedProps {
  category?: string;
  hashtag?: string;
  onCommentClick?: (post: FeedPost) => void;
}

export default function Feed({ category, hashtag, onCommentClick }: FeedProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    let q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    if (category) {
      q = query(
        collection(db, "posts"),
        where("category", "==", category),
        orderBy("createdAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data: FeedPost[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<FeedPost, "id">),
      }));

      if (hashtag) {
        const tag = hashtag.toLowerCase();
        data = data.filter((post) =>
          post.hashtags?.some((t) => t.toLowerCase() === tag)
        );
      }

      setPosts(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [category, hashtag]);

  if (loading) {
    return (
      <div className="py-20 text-center text-zinc-500 dark:text-zinc-400">
        Loading posts...
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