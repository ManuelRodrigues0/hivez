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
}

export default function Feed() {
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

      setPosts(data);

      setLoading(false);
    });

    return unsubscribe;
  }, []);

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
        No posts yet.
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