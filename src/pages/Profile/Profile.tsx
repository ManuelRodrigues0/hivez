import PostActions from "@/components/feed/PostActions";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  MessageCircle,
  Settings,
  Share2,
  Lock,
  Play,
  Grid3X3,
  Film,
  ShieldCheck,
  Repeat2,
} from "lucide-react";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import HivezLoader from "@/components/common/HivezLoader";
import { createNotification } from "@/services/notifications";
import {
  createFollowRequest,
  createPublicFollow,
  listenToSentFollowRequests,
  unfollowUser,
} from "@/services/followRequests";
import type { FeedPost } from "../../components/feed/Feed";
import {
  canViewProfileContent,
  filterVisiblePosts,
  normalizePrivacy,
} from "@/services/privacy";
import type { UserPrivacySettings } from "@/services/privacy";
import {
  listenToPostsByIds,
  listenToUserReHives,
  type ReHiveDoc,
} from "@/services/rehives";

interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  bio: string;
  photoURL: string;
  bannerURL?: string;
  verified: boolean;
  posts: number;
  followers: number;
  following: number;
  privacy?: Partial<UserPrivacySettings>;
  accountPrivacy?: string;
  isPrivate?: boolean;
}

export default function Profile() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get("uid");

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followRequestPending, setFollowRequestPending] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "rehives" | "media">(
    "posts",
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [userPosts, setUserPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [canViewProtectedContent, setCanViewProtectedContent] = useState(false);
  const [reHiveRecords, setReHiveRecords] = useState<ReHiveDoc[]>([]);
  const [reHivePosts, setReHivePosts] = useState<FeedPost[]>([]);
  const [reHivesLoading, setReHivesLoading] = useState(true);

  const isOwnProfile = !uid || uid === currentUser?.uid;
  const profileUid = isOwnProfile ? currentUser?.uid : uid;

  useEffect(() => {
    if (!profileUid) {
      setLoading(false);
      return;
    }

    // Live profile: edits by the profile owner (name, avatar, bio, banner)
    // propagate to anyone viewing this profile without a refresh.
    const unsubscribe = onSnapshot(
      doc(db, "users", profileUid),
      (snap) => {
        if (snap.exists()) {
          setProfile({ ...snap.data(), uid: snap.id } as UserProfile);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load profile:", err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [profileUid]);

  useEffect(() => {
    if (!profileUid || !profile) {
      setCanViewProtectedContent(false);
      return;
    }

    let active = true;
    canViewProfileContent(currentUser?.uid, profileUid, profile).then(
      (allowed) => {
        if (active) setCanViewProtectedContent(allowed);
      },
    );
    return () => {
      active = false;
    };
  }, [currentUser?.uid, profile, profileUid]);

  useEffect(() => {
    if (!profileUid) {
      setPostsLoading(false);
      return;
    }
    if (!canViewProtectedContent) {
      setUserPosts([]);
      setPostsLoading(false);
      return;
    }

    setPostsLoading(true);
    const q = query(collection(db, "posts"), where("uid", "==", profileUid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const posts: FeedPost[] = snapshot.docs.map((doc) => ({
          ...(doc.data() as Omit<FeedPost, "id">), id: doc.id,
        }));

        posts.sort((a, b) => {
          const aTime = a.createdAt?.toDate?.()?.getTime?.() || 0;
          const bTime = b.createdAt?.toDate?.()?.getTime?.() || 0;
          return bTime - aTime;
        });

        filterVisiblePosts(currentUser?.uid, posts).then((visiblePosts) => {
          setUserPosts(visiblePosts);
        });
        setPostsLoading(false);
      },
      (error) => {
        console.error("Error fetching user posts:", error);
        setPostsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [canViewProtectedContent, currentUser?.uid, profileUid]);

  useEffect(() => {
    if (!profileUid || !canViewProtectedContent) {
      setReHiveRecords([]);
      setReHivePosts([]);
      setReHivesLoading(false);
      return;
    }

    setReHivesLoading(true);
    return listenToUserReHives(
      profileUid,
      (records) => {
        setReHiveRecords(records);
        if (!records.length) {
          setReHivePosts([]);
          setReHivesLoading(false);
        }
      },
      (error) => {
        console.error("Error fetching ReHives:", error);
        setReHivesLoading(false);
      },
    );
  }, [canViewProtectedContent, profileUid]);

  useEffect(() => {
    if (!reHiveRecords.length) return;
    return listenToPostsByIds(
      reHiveRecords.map((record) => record.postId),
      async (posts) => {
        const visible = await filterVisiblePosts(currentUser?.uid, posts);
        setReHivePosts(
          reHiveRecords
            .map((record) => visible.find((post) => post.id === record.postId))
            .filter(Boolean) as FeedPost[],
        );
        setReHivesLoading(false);
      },
      (error) => {
        console.error("Error fetching ReHive posts:", error);
        setReHivesLoading(false);
      },
    );
  }, [currentUser?.uid, reHiveRecords]);

  useEffect(() => {
    if (!currentUser || !profileUid || isOwnProfile) {
      setFollowing(false);
      setFollowRequestPending(false);
      return;
    }

    const followUnsub = onSnapshot(
      doc(db, "follows", `${currentUser.uid}_${profileUid}`),
      (snap) => {
        const isFollowing = snap.exists();
        setFollowing(isFollowing);
        if (isFollowing) {
          setFollowRequestPending(false);
        }
      },
      (error) => {
        console.error("Error listening to follow status:", error);
      },
    );

    const requestUnsub = listenToSentFollowRequests(
      currentUser.uid,
      (requests) => {
        const hasPending = requests.some((req) => req.targetId === profileUid);
        setFollowRequestPending(hasPending);
      },
      (error) => {
        console.error("Failed to listen to sent follow requests:", error);
      },
    );

    const profileUnsub = onSnapshot(
      doc(db, "users", profileUid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile((current) =>
            current
              ? {
                  ...current,
                  followers: data.followers || 0,
                  following: data.following || 0,
                }
              : current,
          );
        }
      },
      (error) => {
        console.error("Error listening to profile updates:", error);
      },
    );

    return () => {
      followUnsub();
      requestUnsub();
      profileUnsub();
    };
  }, [currentUser, isOwnProfile, profileUid]);

  async function toggleFollow() {
    if (!currentUser || !profile || isOwnProfile || followBusy) {
      return;
    }

    setFollowBusy(true);
    setLocalError(null);

    try {
      if (following) {
        await unfollowUser(currentUser.uid, profile.uid);

        setFollowing(false);
        setProfile((current) =>
          current
            ? {
                ...current,
                followers: Math.max(0, current.followers - 1),
              }
            : current,
        );
      } else if (followRequestPending) {
        const requestRef = doc(
          db,
          "followRequests",
          `${currentUser.uid}_${profile.uid}`,
        );
        await deleteDoc(requestRef);
        setFollowRequestPending(false);
      } else {
        const privacy = normalizePrivacy(profile);
        if (privacy.account === "private") {
          await createFollowRequest(currentUser.uid, profile.uid);
          setFollowRequestPending(true);

          const mySnap = await getDoc(doc(db, "users", currentUser.uid));
          const myProfile = mySnap.data();

          await createNotification({
            recipientId: profile.uid,
            actor: {
              uid: currentUser.uid,
              username:
                myProfile?.username || currentUser.email?.split("@")[0] || "",
              displayName:
                myProfile?.displayName ||
                currentUser.displayName ||
                "Hivez User",
              photoURL: myProfile?.photoURL || currentUser.photoURL || "",
            },
            type: "follow",
            text: "sent you a follow request",
            link: `/profile?uid=${currentUser.uid}`,
          });
        } else {
          await createPublicFollow(currentUser.uid, profile.uid);
          setFollowing(true);
          setProfile((current) =>
            current
              ? {
                  ...current,
                  followers: (current.followers || 0) + 1,
                }
              : current,
          );
        }
      }
    } catch (error: unknown) {
      console.error("Error in toggle follow:", error);
      setLocalError(
        `Failed: ${error instanceof Error ? error.message : "Could not update follow state."}`,
      );
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-32">
        <HivezLoader size="md" progress={56} label="Loading profile" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-32 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#1c1d1a]/10 bg-white shadow-2xs dark:border-neutral-800 dark:bg-[#121212]">
          <ShieldCheck
            size={26}
            className="text-[#3d654c] dark:text-[#f2c14e]"
          />
        </div>
        <h2 className="mt-4 text-base font-black text-[#1c1d1a] dark:text-white">
          Profile Unavailable
        </h2>
        <p className="mt-1 text-xs text-[#1c1d1a]/60 dark:text-neutral-400">
          This community user account does not exist or has been relocated.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#3d654c] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#32533e] dark:bg-[#f2c14e] dark:text-[#121212] dark:hover:bg-[#dfb041]"
        >
          <ArrowLeft size={14} /> Back
        </button>
      </div>
    );
  }

  const tabs = [
    { key: "posts" as const, label: "Posts", icon: Grid3X3 },
    { key: "rehives" as const, label: "ReHives", icon: Repeat2 },
    { key: "media" as const, label: "Media", icon: Film },
  ];
  const privacy = normalizePrivacy(profile);
  const mediaPosts = userPosts.filter(
    (post) =>
      post.mediaItems?.length || post.mediaUrls?.length || post.mediaUrl,
  );

  function renderProtectedState() {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1c1d1a]/10 bg-white dark:border-neutral-800 dark:bg-[#121212]">
          <Lock size={20} className="text-[#3d654c] dark:text-[#f2c14e]" />
        </div>
        <h3 className="mt-3 text-xs font-bold text-[#1c1d1a] dark:text-white">
          This account is private
        </h3>
        <p className="mt-1 max-w-xs text-[11px] text-[#1c1d1a]/50 dark:text-neutral-400">
          Follow @{profile?.username || "this user"} and wait for approval to
          see protected posts and ReHives.
        </p>
      </div>
    );
  }

  function renderEmptyState(
    icon: "posts" | "rehives" | "media",
    title: string,
    body: string,
  ) {
    const Icon =
      icon === "rehives" ? Repeat2 : icon === "media" ? Film : Grid3X3;
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1c1d1a]/10 bg-white dark:border-neutral-800 dark:bg-[#121212]">
          <Icon size={20} className="text-[#3d654c] dark:text-[#f2c14e]" />
        </div>
        <h3 className="mt-3 text-xs font-bold text-[#1c1d1a] dark:text-white">
          {title}
        </h3>
        <p className="mt-1 text-[11px] text-[#1c1d1a]/50 dark:text-neutral-400">
          {body}
        </p>
      </div>
    );
  }

  function renderPostTile(post: FeedPost, meta?: string) {
    const mediaUrl =
      post.mediaItems?.[0]?.url || post.mediaUrls?.[0] || post.mediaUrl;
    const isVideo =
      post.mediaItems?.[0]?.type === "video" || post.mediaType === "video";
    return (
      <article key={post.id} className="hv-profile-tile">
      <button
        type="button"
        className="hv-profile-tile-open"
        onClick={() => navigate(`/post/${post.id}`)}
        aria-label={`Open post by @${post.username}: ${post.caption?.slice(0, 100) || "Photo or video"}`}
      >
        {mediaUrl ? (
          <>
            {isVideo ? (
              <video
                src={mediaUrl}
                muted
                playsInline
                preload="metadata"
                disablePictureInPicture
              />
            ) : (
              <img src={mediaUrl} alt="" loading="lazy" />
            )}
            <div className="hv-profile-tile-meta">
              {meta || `@${post.username}`}
              {isVideo && <Play size={13} />}
            </div>
          </>
        ) : (
          <div className="hv-profile-tile-copy">
            <p>{post.caption || "Community update"}</p>
            <span>{meta || "A NEIGHBOURHOOD NOTE"}</span>
          </div>
        )}
      </button>
        <div className="hv-profile-tile-counts">
          <PostActions post={post} compact />
        </div>
      </article>
    );
  }
  const shownPosts =
    activeTab === "rehives"
      ? reHivePosts
      : activeTab === "media"
        ? mediaPosts
        : userPosts;
  const shownLoading = activeTab === "rehives" ? reHivesLoading : postsLoading;
  return (
    <div className="app-profile-page hv-profile">
      {!isOwnProfile && (
        <div className="hv-profile-back">
          <button
            className="hv-icon"
            aria-label="Back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={20} />
          </button>
          <span>Around your neighbourhood</span>
        </div>
      )}
      <div className="hv-profile-cover">
        {profile.bannerURL ? (
          <img src={profile.bannerURL} alt="Profile cover" />
        ) : (
          <span className="hv-profile-cover-words">
            Your kind
            <br />
            of local.
          </span>
        )}
      </div>
      <div className="hv-profile-identity">
        <div className="hv-profile-avatar-row">
          {profile.photoURL ? (
            <img
              className="hv-profile-avatar"
              src={profile.photoURL}
              alt={`${profile.displayName}'s profile photo`}
            />
          ) : (
            <div
              className="hv-profile-avatar hv-profile-initial"
              aria-hidden="true"
            >
              {(profile.displayName || profile.username || "H").slice(0, 1)}
            </div>
          )}
          <div className="hv-profile-actions">
            {isOwnProfile ? (
              <button
                className="hv-button-secondary"
                onClick={() => navigate("/profile/edit")}
              >
                <Settings size={14} />
                Edit profile
              </button>
            ) : (
              <>
                <button
                  className={
                    following || followRequestPending
                      ? "hv-button-secondary"
                      : "hv-button"
                  }
                  disabled={followBusy}
                  onClick={toggleFollow}
                >
                  {followBusy
                    ? "Updating?"
                    : following
                      ? "Following"
                      : followRequestPending
                        ? "Requested"
                        : "Follow"}
                </button>
                <button
                  className="hv-icon"
                  aria-label="Open messages"
                  onClick={() => navigate("/chats")}
                >
                  <MessageCircle size={19} />
                </button>
              </>
            )}
            <button
              className="hv-icon"
              aria-label="Share profile"
              onClick={async () => {
                try {
                  if (navigator.share)
                    await navigator.share({
                      title: profile.displayName,
                      url: window.location.href,
                    });
                  else
                    await navigator.clipboard.writeText(window.location.href);
                } catch (failure) {
                  if ((failure as Error).name !== "AbortError")
                    setLocalError(
                      "Couldn?t share this profile. Please try again.",
                    );
                }
              }}
            >
              <Share2 size={17} />
            </button>
          </div>
        </div>
        <div className="hv-profile-details">
          <h1>
            {profile.displayName || "Hivez neighbour"}
            {profile.verified && <BadgeCheck size={22} aria-label="Verified" />}
          </h1>
          <p className="hv-profile-handle">@{profile.username}</p>
          {profile.bio && <p className="hv-profile-bio">{profile.bio}</p>}
          <p className="hv-profile-privacy">
            <Lock size={12} aria-hidden="true" />
            {privacy.account === "private"
              ? "Private account"
              : "Public account"}
            {profile.verified && <span> ? Verified citizen</span>}
          </p>
          <div className="hv-profile-stats">
            <span>
              <strong>{profile.posts || 0}</strong> Posts
            </span>
            <span>
              <strong>{profile.followers || 0}</strong> Followers
            </span>
            <span>
              <strong>{profile.following || 0}</strong> Following
            </span>
          </div>
        </div>
        {localError && (
          <p className="hv-inline-error" role="alert">
            {localError}
          </p>
        )}
      </div>
      <div className="hv-profile-tabs" aria-label="Profile content">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={activeTab === key ? "is-active" : ""}
            aria-pressed={activeTab === key}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
      <div className="hv-profile-body">
        {!canViewProtectedContent ? (
          renderProtectedState()
        ) : shownLoading ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <HivezLoader
              size="md"
              progress={58}
              label="Loading profile posts"
            />
          </div>
        ) : shownPosts.length ? (
          <div className="hv-profile-grid">
            {shownPosts.map((post) =>
              renderPostTile(
                post,
                activeTab === "rehives"
                  ? `ReHived by @${profile.username}`
                  : undefined,
              ),
            )}
          </div>
        ) : (
          renderEmptyState(
            activeTab,
            activeTab === "rehives"
              ? "No ReHives yet"
              : activeTab === "media"
                ? "No photos or videos yet"
                : "A new chapter starts here.",
            isOwnProfile
              ? "Your shared stories and local updates will find a home here."
              : "This neighbour hasn?t shared anything here yet.",
          )
        )}
      </div>
    </div>
  );
}
