/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import {
  MapPin,
  MoreHorizontal,
  BadgeCheck,
  Copy,
  Flag,
  UserMinus,
  ExternalLink,
  Trash2,
  Ban,
  AlertTriangle,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { COMMUNITIES } from "@/constants/communities";
import { db } from "../../firebase/firebase";
import {
  doc,
  updateDoc,
  deleteDoc,
  increment,
  onSnapshot,
} from "firebase/firestore";
import { toast } from "sonner";
import type { FeedPost } from "./Feed";
import { useLiveProfile } from "@/hooks/useLiveProfile";
import { copyTextToClipboard } from "@/services/clipboard";
import {
  formatDistance,
  locationLabel,
  normalizeLocation,
} from "@/services/location";

import MediaGrid from "./MediaGrid";
import type { PostMediaItem } from "./MediaGrid";
import PostActions from "./PostActions";
import { blockIdFor, blockUser, unblockUser } from "@/services/blocks";
import { createReport } from "@/services/admin";
import type { TimestampLike } from "@/types/timestamp";

interface Props {
  post: FeedPost;
  onCommentClick?: (post: FeedPost) => void;
}

function timeAgo(timestamp?: TimestampLike | null) {
  if (!timestamp?.toDate) return "Now";

  const seconds = Math.floor(
    (Date.now() - timestamp.toDate().getTime()) / 1000,
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
  const { user, profile: myProfile } = useAuth();
  const navigate = useNavigate();
  // Live author profile: name/username/avatar/verification stay current even
  // though the post document stores a creation-time snapshot.
  const author = useLiveProfile(post.uid, post) as FeedPost;
  const [blockState, setBlockState] = useState<
    "none" | "blocked-by-me" | "blocked-them"
  >("none");
  const [blockBusy, setBlockBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const mediaItems: PostMediaItem[] = post.mediaItems?.length
    ? post.mediaItems
    : post.mediaUrls?.length
      ? post.mediaUrls.map((url) => ({
          url,
          type: post.mediaType === "video" ? "video" : "image",
        }))
      : post.mediaUrl
        ? [
            {
              url: post.mediaUrl,
              type: post.mediaType === "video" ? "video" : "image",
            },
          ]
        : [];
  const postLocation = normalizeLocation(post.locationSnapshot);
  const readableLocation = locationLabel(postLocation, post.location);

  const menuRef = useRef<HTMLDivElement>(null);
  const optionsButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function dismiss(event: KeyboardEvent | MouseEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setMenuOpen(false);
        optionsButtonRef.current?.focus();
      } else if (event instanceof MouseEvent && !menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("keydown", dismiss);
    document.addEventListener("mousedown", dismiss);
    return () => {
      document.removeEventListener("keydown", dismiss);
      document.removeEventListener("mousedown", dismiss);
    };
  }, [menuOpen]);

  async function handleCopyLink() {
    try {
      await copyTextToClipboard(`${window.location.origin}/post/${post.id}`);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the post link. Please try again.");
    } finally { setMenuOpen(false); }
  }

  // Live block state between the viewer and the post author (either direction).
  useEffect(() => {
    if (!user || !post.uid || user.uid === post.uid) {
      setBlockState("none");
      return;
    }
    return onSnapshot(
      doc(db, "blocks", blockIdFor(user.uid, post.uid)),
      (snap) => {
        if (!snap.exists()) {
          setBlockState("none");
          return;
        }
        const data = snap.data() as { blockerId?: string };
        setBlockState(
          data.blockerId === user.uid ? "blocked-by-me" : "blocked-them",
        );
      },
    );
  }, [post.id, user?.uid, post.uid, user]);

  async function handleCopyText() {
    if (!post.caption) return;
    try {
      await copyTextToClipboard(post.caption);
      toast.success("Text copied");
    } catch (error) {
      console.error("Failed to copy post text:", error);
      toast.error(error instanceof Error ? error.message : "Could not copy the post text");
    } finally {
      setMenuOpen(false);
    }
  }

  async function deletePost() {
    if (!user || user.uid !== post.uid) return;
    setMenuOpen(false);

    const toastId = toast("Delete this post?", {
      description: "This action cannot be undone.",
      duration: 5000,
      position: "bottom-center",
      className:
        "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800",
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

  async function handleBlock() {
    if (!user || !post.uid || blockBusy) return;
    setMenuOpen(false);
    setBlockBusy(true);
    try {
      if (blockState === "blocked-by-me") {
        await unblockUser(user.uid, post.uid);
        toast.success(`Unblocked @${post.username}`);
      } else {
        await blockUser(user.uid, post.uid);
        toast.success(`Blocked @${post.username}`);
      }
    } catch (err) {
      console.error("Failed to update block:", err);
      toast.error("Could not update block");
    } finally {
      setBlockBusy(false);
    }
  }

  async function handleReportPost() {
    if (!user) {
      toast.error("Sign in to report posts");
      return;
    }
    setMenuOpen(false);
    try {
      await createReport({
        reporterId: user.uid,
        reporterName:
          myProfile?.displayName ||
          user.displayName ||
          user.email ||
          "Hivez User",
        targetId: post.id,
        targetType: "post",
        reason: "Reported from feed by user",
      });
      toast.success("Report submitted for review");
    } catch (err) {
      console.error("Failed to report post:", err);
      toast.error("Could not submit report");
    }
  }

  return (
    <>
      <article className="app-feed-card hv-stream-post">
        {/* Header: avatar, identity, more menu */}
        <div className="hv-post-header flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src={
                author.photoURL ||
                "https://ui-avatars.com/api/?name=Hivez&background=3d654c&color=fff"
              }
              alt={author.username}
              className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="hv-post-identity flex items-center gap-1.5 min-w-0">
                <button
                  type="button"
                  onClick={() => navigate(`/profile?uid=${post.uid}`)}
                  className="hv-post-name truncate text-[15px] font-bold text-zinc-900 hover:underline dark:text-white"
                >
                  {author.displayName || author.username}
                </button>
                {author.verified && (
                  <BadgeCheck
                    size={14}
                    className="flex-shrink-0 text-sky-500"
                  />
                )}
                <span className="hv-post-handle min-w-0 truncate text-[13px] text-zinc-500 dark:text-zinc-400">
                  @{author.username}
                </span>
                <span className="text-[13px] text-zinc-400 dark:text-zinc-500">
                  ·
                </span>
                <span className="hv-post-time flex-shrink-0 text-[13px] text-zinc-500 dark:text-zinc-400">
                  {timeAgo(post.createdAt)}
                </span>
              </div>
              {readableLocation && (
                <button
                  type="button"
                  onClick={() => {
                    if (!postLocation) return;
                    navigate(
                      `/map?post=${post.id}&lat=${postLocation.latitude}&lng=${postLocation.longitude}`,
                    );
                  }}
                  className="mt-0.5 inline-flex max-w-full items-center gap-1 text-xs text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                >
                  <MapPin size={12} className="flex-shrink-0" />
                  <span className="truncate">
                    {readableLocation}
                    {typeof post.distanceKm === "number"
                      ? ` · ${formatDistance(post.distanceKm)}`
                      : ""}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Three dot menu */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              aria-label="Post options"
              ref={optionsButtonRef}
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen(!menuOpen);
              }}
              className="-mr-1 flex-shrink-0 rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <MoreHorizontal
                size={20}
                className="text-zinc-500 dark:text-zinc-400"
              />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                />
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
                  <button
                    onClick={() => void handleReportPost()}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Flag size={16} />
                    Report
                  </button>
                  {user && post.uid && user.uid !== post.uid && (
                    <button
                      onClick={handleBlock}
                      disabled={blockBusy}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 disabled:opacity-50 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Ban size={16} />
                      {blockState === "blocked-by-me"
                        ? `Unblock @${post.username}`
                        : `Block @${post.username}`}
                    </button>
                  )}
                  <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <UserMinus size={16} />
                    Mute
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="hv-post-content">
          {/* Hive context */}
          {post.category && (
            <div className="mt-3">
              <span className="hv-post-category inline-flex items-center gap-2 rounded-full bg-[#f2c14e]/15 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8a6d1f] dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-[#f2c14e]" />
                {COMMUNITIES.find((hive) => hive.id === post.category)?.name ||
                  post.category.replaceAll("-", " ")}
              </span>
            </div>
          )}

          {/* Sensitive badge */}
          {post.sensitive && (
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-200/80 px-3 py-1.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                <AlertTriangle size={13} />
                Sensitive
              </span>
            </div>
          )}

          {/* Caption */}
          {post.caption && (
            <div className="mt-3">
              <p className="hv-post-caption whitespace-pre-wrap break-words text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200">
                {post.caption}
              </p>
              {post.hashtags && post.hashtags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {post.hashtags.map((tag, idx) => (
                    <button
                      key={idx}
                      className="text-sm text-primary hover:underline"
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
            <div className="hv-post-media mt-3 min-w-0">
              <MediaGrid
                items={mediaItems}
                variant="stream"
                sensitive={Boolean(post.sensitive)}
              />
            </div>
          )}

          {/* Actions */}
          <PostActions post={post} onCommentClick={onCommentClick} />
        </div>
      </article>

    </>
  );
}
