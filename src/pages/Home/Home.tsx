import { useState, useEffect } from "react";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import Feed from "@/components/feed/Feed";
import CreateModal from "@/components/feed/CreateModal";
import type { FeedPost } from "@/components/feed/Feed";
import MediaGrid from "@/components/feed/MediaGrid";
import type { PostMediaItem } from "@/components/feed/MediaGrid";

export default function Home() {
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  function handleCommentClick(post: FeedPost) {
    setSelectedPost(post);
  }

  function handleCloseComments() {
    setSelectedPost(null);
  }

  return (
    <div className="flex flex-col">
      {/* Either show Feed or Comments */}
      {selectedPost ? (
        <CommentsView post={selectedPost} onClose={handleCloseComments} />
      ) : (
        <>
          <Feed onCommentClick={handleCommentClick} />
          
          {/* Create Modal */}
          <CreateModal
            open={showCreateModal}
            onClose={() => setShowCreateModal(false)}
          />
        </>
      )}
    </div>
  );
}

function CommentsView({ post, onClose }: { post: FeedPost; onClose: () => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const mediaItems: PostMediaItem[] =
    post.mediaItems?.length
      ? post.mediaItems
      : post.mediaUrls?.length
      ? post.mediaUrls.map((url) => ({ url, type: post.mediaType === "video" ? "video" : "image" }))
      : post.mediaUrl
      ? [{ url: post.mediaUrl, type: post.mediaType === "video" ? "video" : "image" }]
      : [];

  useEffect(() => {
    const q = query(
      collection(db, "posts", post.id, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(data);
    });
    return unsubscribe;
  }, [post.id]);

  async function sendComment() {
    if (!user || !text.trim()) return;
    setSending(true);
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const profile = userSnap.data();
      await addDoc(collection(db, "posts", post.id, "comments"), {
        uid: user.uid,
        username: profile?.username || "",
        displayName: profile?.displayName || user.displayName || "",
        photoURL: profile?.photoURL || user.photoURL || "",
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "posts", post.id), {
        comments: increment(1),
      });
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header with back button */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 dark:border-zinc-800 border-zinc-200 bg-white dark:bg-black/95 px-4 py-3 backdrop-blur">
        <button
          onClick={onClose}
          className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-900 dark:text-white">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-base font-semibold text-zinc-900 dark:text-white">Replies</h1>
        <div className="w-10" />
      </div>

      {/* Original Post */}
      <div className="border-b border-zinc-800 dark:border-zinc-800 border-zinc-200 p-4">
        <div className="flex items-center gap-2.5">
          <img
            src={
              post.photoURL ||
              "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"
            }
            alt={post.username}
            className="h-9 w-9 rounded-full object-cover"
          />
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                {post.displayName || post.username}
              </span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                @{post.username}
              </span>
            </div>
          </div>
        </div>
        {post.caption && (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-zinc-900 dark:text-zinc-100">
            {post.caption}
          </p>
        )}
        {mediaItems.length > 0 && (
          <div className="mt-2.5 min-w-0 overflow-hidden">
            <MediaGrid items={mediaItems} compact />
          </div>
        )}
      </div>

      {/* Scrollable Comments */}
      <div className="flex-1 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 dark:text-zinc-400">
            No comments yet. Be the first to reply!
          </div>
        ) : (
          comments.map((comment: any) => (
            <div key={comment.id} className="border-b border-zinc-800 dark:border-zinc-800 border-zinc-200 p-4">
              <div className="flex gap-3">
                <img
                  src={
                    comment.photoURL ||
                    "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"
                  }
                  alt={comment.username}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {comment.displayName || comment.username}
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      @{comment.username}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                    {comment.text}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-zinc-800 dark:border-zinc-800 border-zinc-200 p-4">
        <div className="flex gap-3">
          <img
            src={user?.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
          <div className="flex-1">
            <textarea
              placeholder="Post your reply"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={sendComment}
                disabled={!text.trim() || sending}
                className="rounded-full bg-zinc-900 dark:bg-white px-5 py-1.5 text-sm font-semibold text-white dark:text-black transition hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50"
              >
                Reply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
