/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Repeat2, HandHeart, Bookmark, Share2, Copy, Send } from "lucide-react";
import { motion } from "framer-motion";
import { doc, onSnapshot, runTransaction } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/firebase/firebase";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import type { FeedPost } from "./Feed";
import CommentsSheet from "../comments/CommentsSheet";
import PostSendSheet from "./PostSendSheet";
import { createNotification } from "@/services/notifications";
import { recordPostEngagement } from "@/services/engagementEvents";
import { copyTextToClipboard } from "@/services/clipboard";
import { listenToReHiveState, toggleReHive } from "@/services/rehives";
import { listenToSavedPostState, toggleSavePost } from "@/services/savedPosts";
import { createIssueCommunityForPost, getUserSummary, joinIssueCommunity, listenCommunityByPost, listenCommunityMember } from "@/services/volunteering";
import type { CommunityMember, IssueCommunity } from "@/types/volunteering";

interface Props { post: FeedPost; compact?: boolean; onCommentClick?: (post: FeedPost) => void; }
/** Shared behavior for every interactive post surface. */
export default function PostActions({ post, compact = false, onCommentClick }: Props) {
  const { user, profile: myProfile } = useAuth();
  const { reducedMotion } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes || 0);
  const [reHived, setReHived] = useState(false);
  const [reHiveCount, setReHiveCount] = useState(post.reHives || 0);
  const [reHiving, setReHiving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [sendSheetOpen, setSendSheetOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  const [liking, setLiking] = useState(false);
  const [community, setCommunity] = useState<IssueCommunity | null>(null);
  const [communityMember, setCommunityMember] =
    useState<CommunityMember | null>(null);
  const [volunteerBusy, setVolunteerBusy] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const [commentsCount, setCommentsCount] = useState(post.comments || 0);
  useEffect(() => {
    if (!shareMenuOpen) return;
    function dismiss(event: KeyboardEvent | MouseEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setShareMenuOpen(false);
        shareButtonRef.current?.focus();
      } else if (event instanceof MouseEvent && !shareMenuRef.current?.contains(event.target as Node)) {
        setShareMenuOpen(false);
      }
    }
    document.addEventListener("keydown", dismiss);
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("mousedown", dismiss);
    };
  }, [shareMenuOpen]);
  useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
  }, []);

  function showCopiedFeedback() {
    setCopied(true);
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      copiedTimerRef.current = null;
    }, 1800);
  }

  // Live post data (likes/comments/caption/media/counters) is patched by the
  // Feed's single real-time listener, so no per-card post doc listener is
  // needed here - the card simply reconciles from its props.
  useEffect(() => {
    setLikesCount(post.likes || 0);
  }, [post.likes]);

  useEffect(() => {
    setReHiveCount(post.reHives || 0);
  }, [post.reHives]);

  useEffect(() => {
    if (compact) return;
    return listenCommunityByPost(post.id, setCommunity);
  }, [post.id, compact]);

  useEffect(() => {
    if (!user || !community) {
      setCommunityMember(null);
      return;
    }
    return listenCommunityMember(community.id, user.uid, setCommunityMember);
  }, [community, user]);

  // Check if current user has liked this post
  useEffect(() => {
    if (!user) {
      setLiked(false);
      return;
    }

    const likeRef = doc(db, "posts", post.id, "likes", user.uid);
    const unsubscribe = onSnapshot(likeRef, (snap) => {
      setLiked(snap.exists());
    });
    return () => unsubscribe();
  }, [post.id, user]);

  useEffect(() => {
    return listenToReHiveState(user?.uid, post.id, setReHived);
  }, [post.id, user?.uid]);

  useEffect(() => {
    if (compact) return;
    return listenToSavedPostState(user?.uid, post.id, setSaved);
  }, [post.id, user?.uid, compact]);

  useEffect(() => setCommentsCount(post.comments || 0), [post.comments]);
  // Search uses a one-shot query, so its compact controls subscribe to counter changes.
  useEffect(() => {
    if (!compact || !user) return;
    return onSnapshot(doc(db, "posts", post.id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setLikesCount(data.likes || 0);
      setReHiveCount(data.reHives || 0);
      setCommentsCount(data.comments || 0);
    }, () => { /* Writes surface an actionable error if the post is unavailable. */ });
  }, [compact, post.id, user]);
  async function handleLike() {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    if (liking) return;

    setLiking(true);
    // Optimistic count bump - reconciled by the feed's real-time snapshot
    // (final Firestore state is always the source of truth).
    setLikesCount((count) => (liked ? Math.max(0, count - 1) : count + 1));

    const postRef = doc(db, "posts", post.id);
    const likeRef = doc(db, "posts", post.id, "likes", user.uid);

    let didLike = false;
    try {
      // Atomic like/unlike: prevents double counting from double clicks or
      // simultaneous sessions (read + write in one transaction).
      await runTransaction(db, async (tx) => {
        const [postSnap, likeSnap] = await Promise.all([tx.get(postRef), tx.get(likeRef)]);
        if (!postSnap.exists()) throw new Error("This post is unavailable.");
        const count = Number(postSnap.data().likes) || 0;
        if (likeSnap.exists()) {
          tx.delete(likeRef);
          tx.update(postRef, { likes: Math.max(0, count - 1) });
          didLike = false;
        } else {
          tx.set(likeRef, {
            userId: user.uid,
            createdAt: new Date(),
          });
          tx.update(postRef, { likes: Math.max(0, count) + 1 });
          didLike = true;
        }
      });

    } catch (err) {
      console.error("Failed to update like:", err);
      // Reconcile back to the authoritative state.
      setLiked(liked);
      setLikesCount(post.likes || 0);
      toast.error("Could not update like. Please try again.");
      setLiking(false);
      return;
    }

    try {
      setLiked(didLike);

      if (didLike) {
        const sideEffects = await Promise.allSettled([
          recordPostEngagement({
            postId: post.id,
            actorId: user.uid,
            authorId: post.uid,
            type: "like",
            category: post.category,
          }),
          createNotification({
            recipientId: post.uid,
            actor: {
              uid: user.uid,
              username: myProfile?.username || "",
              displayName:
                myProfile?.displayName || user.displayName || "Hivez User",
              photoURL: myProfile?.photoURL || user.photoURL || "",
            },
            type: "like",
            text: post.caption || "your post",
            link: `/post/${post.id}`,
            postId: post.id,
          }),
        ]);
        if (sideEffects.some((result) => result.status === "rejected")) {
          console.warn("Like was saved, but its notification or engagement event could not be recorded.");
        }
      }
    } finally {
      setLiking(false);
    }
  }

  async function handleReHive() {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    if (reHiving) return;
    setReHiving(true);
    setReHiveCount((count) => (reHived ? Math.max(0, count - 1) : count + 1));

    try {
      const result = await toggleReHive({
        userId: user.uid,
        post,
        actor: {
          uid: user.uid,
          username: myProfile?.username || "",
          displayName:
            myProfile?.displayName || user.displayName || "Hivez User",
          photoURL: myProfile?.photoURL || user.photoURL || "",
        },
      });
      setReHived(result.active);
      toast.success(result.active ? "ReHived" : "ReHive removed", {
        duration: 1400,
      });
    } catch (err) {
      console.error("Failed to update ReHive:", err);
      setReHiveCount(post.reHives || 0);
      toast.error(
        err instanceof Error ? err.message : "Could not update ReHive",
      );
    } finally {
      setReHiving(false);
    }
  }

  async function handleVolunteer() {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    if (volunteerBusy) return;
    setVolunteerBusy(true);
    try {
      let activeCommunity = community;
      if (!activeCommunity) {
        const owner = await getUserSummary(post.uid);
        const communityId = await createIssueCommunityForPost({
          postId: post.id,
          ownerId: post.uid,
          owner,
          caption: post.caption,
          category: post.category,
          location: post.location,
          locationSnapshot: post.locationSnapshot,
          mediaUrl: post.mediaItems?.[0]?.url || post.mediaUrls?.[0] || post.mediaUrl || "",
          mediaType: post.mediaItems?.[0]?.type || post.mediaType,
          linkPost: user.uid === post.uid,
        });
        activeCommunity = {
          id: communityId,
          postId: post.id,
          issueId: post.id,
          title: post.caption || `${post.category || "Community"} issue`,
          description: post.caption || "Community issue",
          category: post.category || "community",
          location: post.location || null,
          locationSnapshot: post.locationSnapshot || null,
          mediaUrl: post.mediaItems?.[0]?.url || post.mediaUrls?.[0] || post.mediaUrl || "",
          mediaType: post.mediaItems?.[0]?.type || post.mediaType,
          ownerId: post.uid,
          owner,
          status: "REPORTED",
          memberCount: 1,
          activityCount: 0,
          rules: [],
          archived: false,
          createdAt: null,
          updatedAt: null,
        };
      }

      if (!communityMember && activeCommunity.ownerId !== user.uid) {
        await joinIssueCommunity(
          activeCommunity,
          await getUserSummary(user.uid),
        );
        void recordPostEngagement({
          postId: post.id,
          actorId: user.uid,
          authorId: post.uid,
          type: "volunteer",
          category: post.category,
        }).catch((error) => console.warn("Volunteer action saved, but its engagement event could not be recorded.", error));
      }
      navigate(`/issue-community/${activeCommunity.id}`);
    } catch (err) {
      console.error("Failed to open volunteer community:", err);
      toast.error("Could not open volunteer community");
    } finally {
      setVolunteerBusy(false);
    }
  }

  async function handleShare() {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      if (navigator.share) {
        try {
          await navigator.share({
            title: post.caption || "Check this post on Hivez",
            url,
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          await copyTextToClipboard(url);
          showCopiedFeedback();
          toast.success("Share sheet unavailable. Link copied instead.");
        }
      } else {
        await copyTextToClipboard(url);
        showCopiedFeedback();
        toast.success("Link copied");
      }
      if (user) {
        void recordPostEngagement({
          postId: post.id,
          actorId: user.uid,
          authorId: post.uid,
          type: "share",
          category: post.category,
        }).catch((error) => console.warn("Post was shared, but its engagement event could not be recorded.", error));
      }
    } catch (error) {
      console.error("Failed to share post:", error);
      toast.error(error instanceof Error ? error.message : "Could not share this post");
    } finally {
      setShareMenuOpen(false);
    }
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/post/${post.id}`;
    try {
      await copyTextToClipboard(url);
      showCopiedFeedback();
      toast.success("Link copied");
      if (user) {
        void recordPostEngagement({
          postId: post.id,
          actorId: user.uid,
          authorId: post.uid,
          type: "share",
          category: post.category,
        }).catch((error) => console.warn("Link was copied, but its engagement event could not be recorded.", error));
      }
    } catch (error) {
      console.error("Failed to copy post link:", error);
      toast.error(error instanceof Error ? error.message : "Could not copy the post link");
    } finally {
      setShareMenuOpen(false);
    }
  }

  async function handleSave() {
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
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
      toast.error(
        err instanceof Error ? err.message : "Could not save this post",
      );
    } finally {
      setSaving(false);
    }
  }

  return (<>
    <div className={compact ? "hv-post-quick-actions" : "hv-post-actions mt-3 flex items-center justify-between border-t border-zinc-200/80 pt-1.5 dark:border-zinc-800/80"}>
      <div className="-ml-2 flex items-center gap-0.5 sm:gap-1">
        <button
          onClick={handleLike}
          aria-label={liked ? "Unlike post" : "Like post"}
          title={liked ? "Unlike" : "Like"}
          aria-pressed={liked}
          disabled={liking}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-red-50 dark:hover:bg-red-950/30 group"
        >
          <motion.div
            animate={
              liked && !reducedMotion
                ? { scale: [1, 1.3, 1] }
                : { scale: 1 }
            }
            transition={{ duration: 0.3 }}
          >
            <Heart
              size={20}
              className={
                liked
                  ? "fill-red-500 text-red-500"
                  : "text-zinc-500 dark:text-zinc-400 group-hover:text-red-500"
              }
            />
          </motion.div>
          <span
            className={`text-[13px] font-medium ${liked ? "text-red-500" : "text-zinc-500 dark:text-zinc-400 group-hover:text-red-500"}`}
          >
            {likesCount}
          </span>
        </button>
        <button
          onClick={() =>
            onCommentClick ? onCommentClick(post) : setCommentsOpen(true)
          }
          aria-label="Comments"
          title="Comments and replies"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-primary/10 group"
        >
          <MessageCircle
            size={20}
            className="text-zinc-500 dark:text-zinc-400 group-hover:text-primary"
          />
          <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 group-hover:text-primary">
            {commentsCount}
          </span>
        </button>
        <button
          type="button"
          onClick={handleReHive}
          disabled={reHiving}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-green-50 disabled:opacity-60 dark:hover:bg-green-950/30 group"
          aria-label={reHived ? "Remove ReHive" : "ReHive post"}
          title={reHived ? "Undo ReHive" : "ReHive to your profile"}
          aria-pressed={reHived}
        >
          <Repeat2
            size={20}
            className={
              reHived
                ? "text-green-500"
                : "text-zinc-500 dark:text-zinc-400 group-hover:text-green-500"
            }
          />
          <span
            className={`text-[13px] font-medium ${reHived ? "text-green-500" : "text-zinc-500 dark:text-zinc-400 group-hover:text-green-500"}`}
          >
            {reHiveCount}
          </span>
        </button>
      </div>

      {!compact && <div className="-mr-2 flex items-center gap-0.5 sm:gap-1">
        <button
          onClick={handleVolunteer}
          title={communityMember || community?.ownerId === user?.uid ? "Open volunteer community" : "Join volunteer community"}
          disabled={volunteerBusy}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-amber-50 disabled:opacity-60 dark:hover:bg-amber-950/30 group"
        >
          <HandHeart
            size={18}
            className={
              communityMember || community?.ownerId === user?.uid
                ? "fill-amber-500 text-amber-500"
                : "text-zinc-500 dark:text-zinc-400 group-hover:text-amber-500"
            }
          />
          <span className="sr-only">
            {community?.ownerId === user?.uid
              ? "Manage"
              : communityMember
                ? "Joined"
                : "Volunteer"}
          </span>
        </button>

        {/* Save post */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          aria-label={saved ? "Remove from saved posts" : "Save post"}
          title={saved ? "Remove from saved posts" : "Save privately"}
          aria-pressed={saved}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-amber-50 disabled:opacity-60 dark:hover:bg-amber-950/30 group"
        >
          <Bookmark
            size={18}
            className={
              saved
                ? "fill-amber-500 text-amber-500"
                : "text-zinc-500 dark:text-zinc-400 group-hover:text-amber-500"
            }
          />
        </button>

        {/* Share button with dropdown */}
        <div className="relative" ref={shareMenuRef}>
          <button
            onClick={() => {
              setShareMenuOpen(!shareMenuOpen);
            }}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-primary/10 group"
            aria-label="Share post"
            title="Share post or copy link"
            ref={shareButtonRef}
            aria-expanded={shareMenuOpen}
          >
            {copied ? (
              <span className="text-xs text-green-500 font-medium">
                Copied!
              </span>
            ) : (
              <Share2
                size={20}
                className="text-zinc-500 dark:text-zinc-400 group-hover:text-primary"
              />
            )}
          </button>
          {shareMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShareMenuOpen(false)}
              />
              <div className="app-popover-menu absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-1 shadow-xl">
                <button
                  onClick={handleShare}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Share2 size={16} />
                  Share
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Copy size={16} />
                  Copy link
                </button>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => user
            ? setSendSheetOpen(true)
            : navigate("/login", { state: { from: location.pathname } })}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-primary/10 group"
          aria-label="Send post via direct message"
          title="Send post in a message"
        >
          <Send
            size={20}
            className="text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500"
          />
        </button>
      </div>}
    </div>
    {createPortal(<><CommentsSheet
      post={post}
      open={commentsOpen}
      onClose={() => setCommentsOpen(false)}
    />
      <PostSendSheet
        post={post}
        open={sendSheetOpen}
        onClose={() => setSendSheetOpen(false)}
      />
    </>, document.querySelector(".hv-app") || document.body)}
  </>);
}
