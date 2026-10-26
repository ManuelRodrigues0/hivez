import { useState } from "react";
import NeighbourhoodContext from "@/components/layout/NeighbourhoodContext";

import CommentsSheet from "@/components/comments/CommentsSheet";
import Feed from "@/components/feed/Feed";
import type { FeedPost } from "@/components/feed/Feed";

export default function Home() {
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);

  return (
    <div className="hv-home">
      <h1 className="sr-only">Your feed</h1>
      <div className="hv-home-columns">
        <div className="hv-home-feed">
          <Feed onCommentClick={setSelectedPost} />
        </div>
        <NeighbourhoodContext />
      </div>

      {selectedPost && (
        <CommentsSheet
          post={selectedPost}
          open
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  );
}
