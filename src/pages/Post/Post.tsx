import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Heart, MessageCircle, Repeat2, Send } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import type { FeedPost } from "../../components/feed/Feed";

function timeAgo(timestamp: any) {
  if (!timestamp?.toDate) return "Now";
  const seconds = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (seconds < 60) return "Now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 52) return `${weeks}w`;
  const years = Math.floor(days / 365);
  return `${years}y`;
}

export default function PostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    async function loadPost() {
      if (!id) return;
      try {
        const snap = await getDoc(doc(db, "posts", id));
        if (snap.exists()) {
          setPost({ id: snap.id, ...snap.data() } as FeedPost);
        }
      } catch (err) {
        console.error("Failed to load post:", err);
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent dark:border-zinc-600" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 dark:bg-black">
        <div className="text-center max-w-md">
          <h1 className="text-6xl font-bold text-zinc-200 dark:text-zinc-800">404</h1>
          <h2 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-white">Post not found</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            This post may have been deleted or the link is invalid.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-semibold text-zinc-900 dark:text-white">Post</h1>
        </div>
      </div>

      {/* Post */}
      <div className="px-4 py-4">
        <div className="flex gap-3">
          <img
            src={post.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"}
            alt={post.username}
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                {post.displayName || post.username}
              </span>
              {post.verified && <BadgeCheck size={14} className="text-sky-500" />}
              <span className="text-sm text-zinc-500 dark:text-zinc-400">@{post.username}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">· {timeAgo(post.createdAt)}</span>
            </div>

            <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-6 text-zinc-800 dark:text-zinc-200">
              {post.caption}
            </p>

            {post.mediaUrl && (
              <div className="mt-3">
                {post.mediaType === "image" ? (
                  <img src={post.mediaUrl} alt="" className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700" />
                ) : (
                  <video src={post.mediaUrl} controls className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-700" />
                )}
              </div>
            )}

            <div className="mt-4 flex items-center gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <button
                onClick={() => setLiked(!liked)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Heart size={18} className={liked ? "fill-red-500 text-red-500" : "text-zinc-500 dark:text-zinc-400"} />
                <span className={`text-xs ${liked ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {post.likes + (liked ? 1 : 0)}
                </span>
              </button>
              <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-sky-50 dark:hover:bg-sky-950/30">
                <MessageCircle size={18} className="text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{post.comments}</span>
              </button>
              <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-green-50 dark:hover:bg-green-950/30">
                <Repeat2 size={18} className="text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{post.shares}</span>
              </button>
              <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-blue-50 dark:hover:bg-blue-950/30">
                <Send size={18} className="text-zinc-500 dark:text-zinc-400" />
              </button>
            </div>

            <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-white">{post.likes}</span> likes
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}