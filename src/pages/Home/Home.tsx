import { useState } from "react";

import CommentsSheet from "@/components/comments/CommentsSheet";
import CreateModal from "@/components/feed/CreateModal";
import Feed from "@/components/feed/Feed";
import type { FeedPost } from "@/components/feed/Feed";

export default function Home() {
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="flex flex-col">
      <Feed onCommentClick={setSelectedPost} />

      <CreateModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

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
