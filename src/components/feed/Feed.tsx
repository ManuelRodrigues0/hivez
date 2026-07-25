import { useEffect, useState } from "react";

import {
  collection,
  onSnapshot,
  orderBy,
  query,
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
}

interface FeedProps {
  category?: string;
}

export default function Feed({ category }: FeedProps) {
  const [posts, setPosts] = useState<FeedPost[]>([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: FeedPost[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<FeedPost, "id">),
      }));

      if (category) {
        setPosts(
          data.filter((post) => post.category === category)
        );
      } else {
        setPosts(data);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [category]);

  if (loading) {
    return (
      <div className="py-20 text-center text-zinc-500">
        Loading posts...
      </div>
    );
  }

  if (!posts.length) {
    return (
      <div className="py-20 text-center text-zinc-500">
        {category
          ? "No posts in this Hive yet."
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
        />
      ))}
    </div>
  );
}