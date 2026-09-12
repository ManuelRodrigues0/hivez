/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Heart, MessageCircle, Repeat2, Send, Share2, Trash2, ShieldX, LogIn, UserPlus, Bookmark, AlertTriangle } from "lucide-react";
import { doc, deleteDoc, updateDoc, onSnapshot, runTransaction, increment } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import HivezLoader from "@/components/common/HivezLoader";
import type { FeedPost } from "../../components/feed/Feed";
import MediaGrid from "../../components/feed/MediaGrid";
import type { PostMediaItem } from "../../components/feed/MediaGrid";
import { useLiveProfile } from "@/hooks/useLiveProfile";
import CommentsSheet from "@/components/comments/CommentsSheet";
import PostSendSheet from "@/components/feed/PostSendSheet";
import { listenToReHiveState, toggleReHive } from "@/services/rehives";
import { listenToSavedPostState, toggleSavePost } from "@/services/savedPosts";
import { recordPostEngagement } from "@/services/engagementEvents";
import type { TimestampLike } from "@/types/timestamp";

function timeAgo(timestamp?: TimestampLike | null) {
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
  const { user, profile, loading: authLoading } = useAuth();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [reHived, setReHived] = useState(false);
  const [reHiving, setReHiving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sendSheetOpen, setSendSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live post: edits, status changes and deletions propagate without refresh.
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, "posts", id),
      (snap) => {
        if (snap.exists()) {
          setPost({ id: snap.id, ...snap.data() } as FeedPost);
          setError(null);
        } else {
          setError("This post doesn't exist.");
        }
        setLoading(false);
      },
      (err: unknown) => {
        console.error("Failed to load post:", err);
        if (typeof err === "object" && err && "code" in err && err.code === "permission-denied") {
          setError("Unable to load this post. It may not be publicly accessible. Check your Firestore security rules.");
        } else {
          setError("Failed to load this post. Please try again.");
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Real-time liked state for the current user (shared with the feed).
  useEffect(() => {
    if (!user || !id) {
      setLiked(false);
      return;
    }
    const unsubscribe = onSnapshot(doc(db, "posts", id, "likes", user.uid), (snap) => {
      setLiked(snap.exists());
    });
    return () => unsubscribe();
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    return listenToReHiveState(user?.uid, id, setReHived);
  }, [id, user?.uid]);

  useEffect(() => {
    if (!id) return;
    return listenToSavedPostState(user?.uid, id, setSaved);
  }, [id, user?.uid]);

  // Atomic like/unlike shared with the feed implementation.
  async function toggleLike() {
    if (!user || !id || liking) {
      if (!user) navigate("/login");
      return;
    }
    setLiking(true);
    const postRef = doc(db, "posts", id);
    const likeRef = doc(db, "posts", id, "likes", user.uid);
    try {
      await runTransaction(db, async (tx) => {
        const likeSnap = await tx.get(likeRef);
        if (likeSnap.exists()) {
          tx.delete(likeRef);
          tx.update(postRef, { likes: increment(-1) });
        } else {
          tx.set(likeRef, { userId: user.uid, createdAt: new Date() });
          tx.update(postRef, { likes: increment(1) });
        }
      });
    } catch (err) {
      console.error("Failed to update like:", err);
      toast.error("Could not update like. Please try again.");
    } finally {
      setLiking(false);
    }
  }

  async function handleReHive() {
    if (!user || !post || reHiving) {
      if (!user) navigate("/login");
      return;
    }

    setReHiving(true);
    try {
      await toggleReHive({
        userId: user.uid,
        post,
        actor: {
          uid: user.uid,
          username: profile?.username || "",
          displayName: profile?.displayName || user.displayName || "Hivez User",
          photoURL: profile?.photoURL || user.photoURL || "",
        },
      });
    } catch (err) {
      console.error("Failed to update ReHive:", err);
      toast.error(err instanceof Error ? err.message : "Could not update ReHive");
    } finally {
      setReHiving(false);
    }
  }

  async function handleSave() {
    if (!user || !post) {
      if (!user) navigate("/login");
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      const result = await toggleSavePost({ userId: user.uid, post });
      setSaved(result.saved);
      toast.success(result.saved ? "Post saved" : "Post removed from saved");
    } catch (err) {
      console.error("Failed to save post:", err);
      toast.error(err instanceof Error ? err.message : "Could not save this post");
    } finally {
      setSaving(false);
    }
  }

  const author = useLiveProfile(post?.uid, post) as FeedPost | null;

  if (loading || authLoading) {
    return <HivezLoader fullScreen size="lg" progress={authLoading ? 42 : 64} label="Loading post" />;
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

  async function deletePost() {
    if (!user || !post || user.uid !== post.uid) return;
    
    const toastId = toast("Delete this post?", {
      description: "This action cannot be undone.",
      duration: 5000,
      position: "bottom-center",
      className: "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await deleteDoc(doc(db, "posts", post.id));
            await updateDoc(doc(db, "users", user.uid), {
              posts: increment(-1),
            });
            toast.success("Post deleted", {
              duration: 2000,
              position: "bottom-center",
            });
            navigate("/");
          } catch (err) {
            console.error("Failed to delete post:", err);
            toast.error("Failed to delete post", {
              duration: 2000,
              position: "bottom-center",
            });
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => toast.dismiss(toastId),
      },
    });
  }

  const handleLogin = () => {
    // Navigate to login and come back to this post after login
    navigate("/login", { state: { from: `/post/${id}` } });
  };

  const handleSignup = () => {
    // Navigate to signup and come back to this post after signup
    navigate("/signup", { state: { from: `/post/${id}` } });
  };

  async function sharePost() {
    if (!post) return;
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: post.caption || "Check this post on Hivez", url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
      if (user) {
        await recordPostEngagement({
          postId: post.id,
          actorId: user.uid,
          authorId: post.uid,
          type: "share",
          category: post.category,
        });
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  }

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
<div className="border-b border-zinc-200 bg-sky-50 px-4 py-3 dark:border-zinc-800 dark:bg-sky-950/30">
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
            src={author?.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"}
            alt={author?.username || post.username}
            className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                {author?.displayName || post.displayName || post.username}
              </span>
              {(author?.verified || post.verified) && <BadgeCheck size={14} className="text-sky-500" />}
              <span className="text-sm text-zinc-500 dark:text-zinc-400">@{author?.username || post.username}</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">· {timeAgo(post.createdAt)}</span>
            </div>

            <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-6 text-zinc-800 dark:text-zinc-200">
              {post.caption}
            </p>

            {mediaItems.length > 0 && (
              <div className="mt-3 min-w-0 overflow-hidden">
                <MediaGrid items={mediaItems} sensitive={Boolean(post.sensitive)} />
              </div>
            )}

            {post.sensitive && (
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-200/80 px-3 py-1.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  <AlertTriangle size={13} />
                  Sensitive
                </span>
              </div>
            )}

            <div className="mt-4 flex items-center gap-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
              <button
                onClick={() => (user ? toggleLike() : navigate("/login"))}
                disabled={liking}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-red-50 disabled:opacity-60 dark:hover:bg-red-950/30"
              >
                <Heart size={18} className={liked ? "fill-red-500 text-red-500" : "text-zinc-500 dark:text-zinc-400"} />
                <span className={`text-xs ${liked ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {post.likes || 0}
                </span>
              </button>
              <button
                onClick={() => (user ? setCommentsOpen(true) : navigate("/login"))}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-sky-50 dark:hover:bg-sky-950/30"
              >
                <MessageCircle size={18} className="text-zinc-500 dark:text-zinc-400" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{post.comments}</span>
              </button>
              <button
                onClick={handleReHive}
                disabled={!user || reHiving}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-green-50 disabled:opacity-60 dark:hover:bg-green-950/30"
              >
                <Repeat2 size={18} className={reHived ? "text-green-500" : "text-zinc-500 dark:text-zinc-400"} />
                <span className={`text-xs ${reHived ? "text-green-500" : "text-zinc-500 dark:text-zinc-400"}`}>{post.reHives || 0}</span>
              </button>
              <button
                onClick={sharePost}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-blue-50 dark:hover:bg-blue-950/30"
                aria-label="Share post"
              >
                <Share2 size={18} className="text-zinc-500 dark:text-zinc-400" />
              </button>
              <button
                onClick={() => (user ? setSendSheetOpen(true) : navigate("/login"))}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-blue-50 dark:hover:bg-blue-950/30"
                aria-label="Send post via direct message"
              >
                <Send size={18} className="text-zinc-500 dark:text-zinc-400" />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                aria-label={saved ? "Remove from saved posts" : "Save post"}
                aria-pressed={saved}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-amber-50 disabled:opacity-60 dark:hover:bg-amber-950/30"
              >
                <Bookmark size={18} className={saved ? "fill-amber-500 text-amber-500" : "text-zinc-500 dark:text-zinc-400"} />
              </button>
              {user && post.uid === user.uid && (
                <button
                  onClick={deletePost}
                  className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>

            <div className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-white">{post.likes}</span> likes
            </div>
          </div>
        </div>
      </div>
      <CommentsSheet post={post} open={commentsOpen} onClose={() => setCommentsOpen(false)} />
      <PostSendSheet post={post} open={sendSheetOpen} onClose={() => setSendSheetOpen(false)} />
    </div>
  );
}
