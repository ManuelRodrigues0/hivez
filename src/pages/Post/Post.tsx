import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Heart, MessageCircle, Repeat2, Send, ShieldX, LogIn, UserPlus } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext";
import type { FeedPost } from "../../components/feed/Feed";
import MediaGrid from "../../components/feed/MediaGrid";
import type { PostMediaItem } from "../../components/feed/MediaGrid";

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
  const { user, loading: authLoading } = useAuth();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPost() {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "posts", id));
        if (snap.exists()) {
          setPost({ id: snap.id, ...snap.data() } as FeedPost);
        } else {
          setError("This post doesn't exist.");
        }
      } catch (err: any) {
        console.error("Failed to load post:", err);
        if (err?.code === "permission-denied") {
          setError("Unable to load this post. It may not be publicly accessible. Check your Firestore security rules.");
          toast.error("Permission denied. Update Firestore rules to allow public read access.");
        } else {
          setError("Failed to load this post. Please try again.");
          toast.error("Failed to load post.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [id]);

  if (loading || authLoading) {
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
          {error?.includes("Permission") ? (
            <>
              <ShieldX size={48} className="mx-auto mb-4 text-zinc-400" />
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-white">Access Denied</h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{error}</p>
              <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
                <p className="font-medium">Fix this in Firebase Console:</p>
                <ol className="mt-2 list-decimal space-y-1 text-left pl-4">
                  <li>Go to Firebase Console → Firestore → Rules</li>
                  <li>Replace current rules with:
                    <code className="mt-1 block rounded bg-yellow-100 p-2 text-xs dark:bg-yellow-900">
                      match /posts/&#123;postId&#125; &#123;<br/>
                      &nbsp;&nbsp;allow read: if true;<br/>
                      &nbsp;&nbsp;allow write: if request.auth != null;<br/>
                      &#125;
                    </code>
                  </li>
                  <li>Click Publish</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-6xl font-bold text-zinc-200 dark:text-zinc-800">404</h1>
              <h2 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-white">Post not found</h2>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                {error || "This post may have been deleted or the link is invalid."}
              </p>
            </>
          )}
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

  const handleBack = () => {
    // If there's browser history, go back; otherwise go to home feed
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  const handleLogin = () => {
    // Navigate to login and come back to this post after login
    navigate("/login", { state: { from: `/post/${id}` } });
  };

  const handleSignup = () => {
    // Navigate to signup and come back to this post after signup
    navigate("/signup", { state: { from: `/post/${id}` } });
  };
  const mediaItems: PostMediaItem[] =
    post.mediaItems?.length
      ? post.mediaItems
      : post.mediaUrls?.length
      ? post.mediaUrls.map((url) => ({ url, type: post.mediaType === "video" ? "video" : "image" }))
      : post.mediaUrl
      ? [{ url: post.mediaUrl, type: post.mediaType === "video" ? "video" : "image" }]
      : [];

  return (
    <div className="app-page">
      {/* Header */}
      <div className="app-sticky-header">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={handleBack}
            className="app-icon-button"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-semibold text-zinc-900 dark:text-white">Post</h1>
        </div>
      </div>

      {/* Login/Signup prompt for unauthenticated users */}
      {!user && (
        <div className="border-b border-zinc-200 bg-gradient-to-r from-sky-50 to-blue-50 px-4 py-3 dark:border-zinc-800 dark:from-sky-950/30 dark:to-blue-950/30">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Join Hivez to like, comment, and connect with creators.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleLogin}
              className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              <LogIn size={14} />
              Log in
            </button>
            <button
              onClick={handleSignup}
              className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
            >
              <UserPlus size={14} />
              Sign up
            </button>
          </div>
        </div>
      )}

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

            {mediaItems.length > 0 && (
              <div className="mt-3 min-w-0 overflow-hidden">
                <MediaGrid items={mediaItems} />
              </div>
            )}

            <div className="mt-4 flex items-center gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <button
                onClick={() => user ? setLiked(!liked) : toast.info("Please log in to like")}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Heart size={18} className={liked ? "fill-red-500 text-red-500" : "text-zinc-500 dark:text-zinc-400"} />
                <span className={`text-xs ${liked ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {post.likes + (liked ? 1 : 0)}
                </span>
              </button>
              <button
                onClick={() => user ? toast.info("Comments coming soon") : toast.info("Please log in to comment")}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-sky-50 dark:hover:bg-sky-950/30"
              >
                <MessageCircle size={18} className="text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{post.comments}</span>
              </button>
              <button
                onClick={() => user ? toast.info("Repost coming soon") : toast.info("Please log in to repost")}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-green-50 dark:hover:bg-green-950/30"
              >
                <Repeat2 size={18} className="text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{post.shares}</span>
              </button>
              <button
                onClick={() => user ? toast.info("Share coming soon") : toast.info("Please log in to share")}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
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
