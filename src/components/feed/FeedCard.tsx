import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  Heart,
  MapPin,
  MessageCircle,
  Repeat2,
  Send,
  MoreHorizontal,
  BadgeCheck,
  Copy,
  Flag,
  UserMinus,
  Share2,
  ExternalLink,
  Trash2,
  HandHeart,
} from "lucide-react";
import { motion } from "framer-motion";

import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/firebase";
import { doc, updateDoc, deleteDoc, setDoc, increment, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";
import type { FeedPost } from "./Feed";
import { createNotification } from "@/services/notifications";
import {
  createIssueCommunityForPost,
  getUserSummary,
  joinIssueCommunity,
  listenCommunityByPost,
  listenCommunityMember,
} from "@/services/volunteering";
import type { CommunityMember, IssueCommunity } from "@/types/volunteering";
import { recordPostEngagement } from "@/services/engagementEvents";
import { formatDistance, locationLabel, normalizeLocation } from "@/services/location";

import CommentsSheet from "../comments/CommentsSheet";
import MediaGrid from "./MediaGrid";
import type { PostMediaItem } from "./MediaGrid";

interface Props {
  post: FeedPost;
  onCommentClick?: (post: FeedPost) => void;
}

function timeAgo(timestamp: any) {
  if (!timestamp?.toDate) return "Now";

  const seconds = Math.floor(
    (Date.now() - timestamp.toDate().getTime()) / 1000
  );

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

export default function FeedCard({ post, onCommentClick }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liking, setLiking] = useState(false);
  const [community, setCommunity] = useState<IssueCommunity | null>(null);
  const [communityMember, setCommunityMember] = useState<CommunityMember | null>(null);
  const [volunteerBusy, setVolunteerBusy] = useState(false);
  const mediaItems: PostMediaItem[] =
    post.mediaItems?.length
      ? post.mediaItems
      : post.mediaUrls?.length
      ? post.mediaUrls.map((url) => ({ url, type: post.mediaType === "video" ? "video" : "image" }))
      : post.mediaUrl
      ? [{ url: post.mediaUrl, type: post.mediaType === "video" ? "video" : "image" }]
      : [];
  const postLocation = normalizeLocation(post.locationSnapshot);
  const readableLocation = locationLabel(postLocation, post.location);

  const menuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShareMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Listen to post data changes in real-time (likes, comments, shares)
  useEffect(() => {
    const postRef = doc(db, "posts", post.id);
    const unsubscribe = onSnapshot(postRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setLikesCount(data.likes || 0);
        // Update comments count if it changes
        if (data.comments !== undefined && data.comments !== post.comments) {
          // This will trigger a re-render with updated comment count
        }
      }
    });
    return () => unsubscribe();
  }, [post.id]);

  useEffect(() => {
    return listenCommunityByPost(post.id, setCommunity);
  }, [post.id]);

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

  async function handleLike() {
    if (!user || liking) {
      if (!user) return;
    }

    setLiking(true);

    const postRef = doc(db, "posts", post.id);
    const likeRef = doc(db, "posts", post.id, "likes", user.uid);

    try {
      if (liked) {
        // Unlike
        await deleteDoc(likeRef);
        await updateDoc(postRef, {
          likes: increment(-1),
        });
        setLiked(false);
      } else {
        // Like
        await setDoc(likeRef, {
          userId: user.uid,
          createdAt: new Date(),
        });
        await updateDoc(postRef, {
          likes: increment(1),
        });
        await recordPostEngagement({
          postId: post.id,
          actorId: user.uid,
          authorId: post.uid,
          type: "like",
          category: post.category,
        });
        await createNotification({
          recipientId: post.uid,
          actor: {
            uid: user.uid,
            username: user.email?.split("@")[0] || "",
            displayName: user.displayName || user.email?.split("@")[0] || "Hivez User",
            photoURL: user.photoURL || "",
          },
          type: "like",
          text: post.caption || "your post",
          link: `/post/${post.id}`,
          postId: post.id,
        });
        setLiked(true);
      }
    } catch (err) {
      console.error("Failed to update like:", err);
    } finally {
      setLiking(false);
    }
  }

  async function handleVolunteer() {
    if (!user || volunteerBusy) return;
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
          mediaUrl: mediaItems[0]?.url || post.mediaUrl || "",
          mediaType: mediaItems[0]?.type || post.mediaType,
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
          mediaUrl: mediaItems[0]?.url || post.mediaUrl || "",
          mediaType: mediaItems[0]?.type || post.mediaType,
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
        await joinIssueCommunity(activeCommunity, await getUserSummary(user.uid));
        await recordPostEngagement({
          postId: post.id,
          actorId: user.uid,
          authorId: post.uid,
          type: "volunteer",
          category: post.category,
        });
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
    if (navigator.share) {
      await navigator.share({
        title: post.caption || "Check this post on Hivez",
        url,
      });
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
    if (user) {
      await recordPostEngagement({ postId: post.id, actorId: user.uid, authorId: post.uid, type: "share", category: post.category });
    }
    setShareMenuOpen(false);
  }

  async function handleCopyLink() {
    const url = `${window.location.origin}/post/${post.id}`;
    await navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    if (user) {
      await recordPostEngagement({ postId: post.id, actorId: user.uid, authorId: post.uid, type: "share", category: post.category });
    }
    setShareMenuOpen(false);
  }

  function handleCopyText() {
    if (post.caption) {
      navigator.clipboard.writeText(post.caption);
    }
    setMenuOpen(false);
  }

  async function deletePost() {
    if (!user || user.uid !== post.uid) return;
    setMenuOpen(false);

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

  return (
    <>
      <article className="app-feed-card border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
        <div className="flex gap-3">
          {/* Avatar column */}
          <div className="flex flex-col items-center">
            <img
              src={
                post.photoURL ||
                "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"
              }
              alt={post.username}
              className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
            />
            <div className="mt-1 w-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          </div>

          {/* Content column */}
          <div className="min-w-0 flex-1">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white hover:underline cursor-pointer">
                  {post.displayName || post.username}
                </span>
                {post.verified && (
                  <BadgeCheck size={14} className="flex-shrink-0 text-sky-500" />
                )}
                <span className="hidden sm:inline text-sm text-zinc-500 dark:text-zinc-400 truncate">
                  @{post.username}
                </span>
                <span className="text-sm text-zinc-400 dark:text-zinc-500">·</span>
                <span className="text-sm text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                  {timeAgo(post.createdAt)}
                </span>
                {readableLocation && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!postLocation) return;
                      navigate(`/map?post=${post.id}&lat=${postLocation.latitude}&lng=${postLocation.longitude}`);
                    }}
                    className="inline-flex min-w-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                  >
                    <MapPin size={13} />
                    <span className="max-w-[150px] truncate">
                      {readableLocation}
                      {typeof post.distanceKm === "number" ? ` · ${formatDistance(post.distanceKm)}` : ""}
                    </span>
                  </button>
                )}
              </div>

              {/* Three dot menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => {
                    setMenuOpen(!menuOpen);
                    setShareMenuOpen(false);
                  }}
                  className="flex-shrink-0 rounded-full p-1.5 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <MoreHorizontal size={16} className="text-zinc-500 dark:text-zinc-400" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <div className="app-popover-menu absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-1 shadow-xl">
                      <button
                        onClick={handleCopyText}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <Copy size={16} />
                        Copy text
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <ExternalLink size={16} />
                        Copy link
                      </button>
                      {user && user.uid === post.uid && (
                        <>
                          <hr className="mx-3 border-zinc-200 dark:border-zinc-700" />
                          <button
                            onClick={deletePost}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Trash2 size={16} />
                            Delete
                          </button>
                        </>
                      )}
                      <hr className="mx-3 border-zinc-200 dark:border-zinc-700" />
                      <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30">
                        <Flag size={16} />
                        Report
                      </button>
                      <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <UserMinus size={16} />
                        Mute
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Caption */}
            {post.caption && (
              <div className="mt-1">
                <p className="whitespace-pre-wrap break-words text-[15px] leading-5 text-zinc-800 dark:text-zinc-200">
                  {post.caption}
                </p>
                {post.hashtags && post.hashtags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {post.hashtags.map((tag, idx) => (
                      <button
                        key={idx}
                        className="text-sm text-sky-500 hover:underline"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Media */}
            {mediaItems.length > 0 && (
              <div className="mt-2.5 min-w-0 overflow-hidden">
                <MediaGrid items={mediaItems} />
              </div>
            )}

            {/* Actions */}
            <div className="mt-2 -ml-2 flex items-center gap-1">
              <button
                onClick={handleLike}
                disabled={liking}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-red-50 dark:hover:bg-red-950/30 group"
              >
                <motion.div
                  animate={liked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Heart
                    size={18}
                    className={
                      liked
                        ? "fill-red-500 text-red-500"
                        : "text-zinc-500 dark:text-zinc-400 group-hover:text-red-500"
                    }
                  />
                </motion.div>
                <span className={`text-xs ${liked ? "text-red-500" : "text-zinc-500 dark:text-zinc-400 group-hover:text-red-500"}`}>
                  {likesCount}
                </span>
              </button>
              <button
                onClick={() => onCommentClick?.(post)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-sky-50 dark:hover:bg-sky-950/30 group"
              >
                <MessageCircle size={18} className="text-zinc-500 dark:text-zinc-400 group-hover:text-sky-500" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-sky-500">
                  {post.comments}
                </span>
              </button>
              <button className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-green-50 dark:hover:bg-green-950/30 group">
                <Repeat2 size={18} className="text-zinc-500 dark:text-zinc-400 group-hover:text-green-500" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400 group-hover:text-green-500">
                  {post.shares}
                </span>
              </button>
              <button
                onClick={handleVolunteer}
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
                <span className="hidden text-xs font-semibold text-zinc-500 group-hover:text-amber-500 dark:text-zinc-400 sm:inline">
                  {community?.ownerId === user?.uid ? "Manage" : communityMember ? "Joined" : "Volunteer"}
                </span>
              </button>

              {/* Share button with dropdown */}
              <div className="relative" ref={shareMenuRef}>
                <button
                  onClick={() => {
                    setShareMenuOpen(!shareMenuOpen);
                    setMenuOpen(false);
                  }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition hover:bg-blue-50 dark:hover:bg-blue-950/30 group"
                >
                  {copied ? (
                    <span className="text-xs text-green-500 font-medium">Copied!</span>
                  ) : (
                    <Send size={18} className="text-zinc-500 dark:text-zinc-400 group-hover:text-blue-500" />
                  )}
                </button>
                {shareMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShareMenuOpen(false)} />
                    <div className="app-popover-menu absolute left-0 top-full z-50 mt-1 w-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-1 shadow-xl">
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
            </div>
          </div>
        </div>
      </article>

      <CommentsSheet
        post={post}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
      />
    </>
  );
}
