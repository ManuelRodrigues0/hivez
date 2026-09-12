/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  MessageCircle,
  UserPlus,
  Settings,
  Share2,
  Heart,
  Lock,
  MessageSquare,
  Play,
  Grid3X3,
  Film,
  Sparkles,
  ShieldCheck,
  Calendar,
  Repeat2,
} from "lucide-react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import HivezLoader from "@/components/common/HivezLoader";
import { createNotification } from "@/services/notifications";
import { createFollowRequest, createPublicFollow, listenToSentFollowRequests, unfollowUser } from "@/services/followRequests";
import type { FeedPost } from "../../components/feed/Feed";
import { canViewProfileContent, filterVisiblePosts, normalizePrivacy } from "@/services/privacy";
import type { UserPrivacySettings } from "@/services/privacy";
import { listenToPostsByIds, listenToUserReHives, type ReHiveDoc } from "@/services/rehives";

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
  const [activeTab, setActiveTab] = useState<"posts" | "rehives" | "media">("posts");
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
          setProfile({ uid: snap.id, ...snap.data() } as UserProfile);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load profile:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [profileUid]);

  useEffect(() => {
    if (!profileUid || !profile) {
      setCanViewProtectedContent(false);
      return;
    }

    let active = true;
    canViewProfileContent(currentUser?.uid, profileUid, profile).then((allowed) => {
      if (active) setCanViewProtectedContent(allowed);
    });
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
          id: doc.id,
          ...(doc.data() as Omit<FeedPost, "id">),
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
      }
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
      }
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
            .filter(Boolean) as FeedPost[]
        );
        setReHivesLoading(false);
      },
      (error) => {
        console.error("Error fetching ReHive posts:", error);
        setReHivesLoading(false);
      }
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
      }
    );

    const requestUnsub = listenToSentFollowRequests(
      currentUser.uid,
      (requests) => {
        const hasPending = requests.some((req) => req.targetId === profileUid);
        setFollowRequestPending(hasPending);
      },
      (error) => {
        console.error("Failed to listen to sent follow requests:", error);
      }
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
              : current
          );
        }
      },
      (error) => {
        console.error("Error listening to profile updates:", error);
      }
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
            : current
        );
      } else if (followRequestPending) {
        const requestRef = doc(db, "followRequests", `${currentUser.uid}_${profile.uid}`);
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
              username: myProfile?.username || currentUser.email?.split("@")[0] || "",
              displayName: myProfile?.displayName || currentUser.displayName || "Hivez User",
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
              : current
          );
        }
      }
    } catch (error: unknown) {
      console.error("Error in toggle follow:", error);
      setLocalError(`Failed: ${error instanceof Error ? error.message : "Could not update follow state."}`);
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
          <ShieldCheck size={26} className="text-[#3d654c] dark:text-[#f2c14e]" />
        </div>
        <h2 className="mt-4 text-base font-black text-[#1c1d1a] dark:text-white">Profile Unavailable</h2>
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
  const mediaPosts = userPosts.filter((post) => post.mediaItems?.length || post.mediaUrls?.length || post.mediaUrl);

  function renderProtectedState() {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1c1d1a]/10 bg-white dark:border-neutral-800 dark:bg-[#121212]">
          <Lock size={20} className="text-[#3d654c] dark:text-[#f2c14e]" />
        </div>
        <h3 className="mt-3 text-xs font-bold text-[#1c1d1a] dark:text-white">This account is private</h3>
        <p className="mt-1 max-w-xs text-[11px] text-[#1c1d1a]/50 dark:text-neutral-400">
          Follow @{profile?.username || "this user"} and wait for approval to see protected posts and ReHives.
        </p>
      </div>
    );
  }

  function renderEmptyState(icon: "posts" | "rehives" | "media", title: string, body: string) {
    const Icon = icon === "rehives" ? Repeat2 : icon === "media" ? Film : Grid3X3;
    return (
      <div className="flex min-h-[220px] flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#1c1d1a]/10 bg-white dark:border-neutral-800 dark:bg-[#121212]">
          <Icon size={20} className="text-[#3d654c] dark:text-[#f2c14e]" />
        </div>
        <h3 className="mt-3 text-xs font-bold text-[#1c1d1a] dark:text-white">{title}</h3>
        <p className="mt-1 text-[11px] text-[#1c1d1a]/50 dark:text-neutral-400">{body}</p>
      </div>
    );
  }

  function renderPostTile(post: FeedPost, meta?: string) {
    const mediaUrl = post.mediaItems?.[0]?.url || post.mediaUrls?.[0] || post.mediaUrl;
    const isVideo = post.mediaItems?.[0]?.type === "video" || post.mediaType === "video";

    return (
      <button
        key={`${meta || "post"}-${post.id}`}
        onClick={() => navigate(`/post/${post.id}`)}
        className="group relative aspect-square w-full overflow-hidden rounded-xl border border-[#1c1d1a]/5 bg-white text-left shadow-2xs transition hover:border-[#3d654c]/30 focus:outline-none focus:ring-2 focus:ring-[#3d654c]/30 dark:border-neutral-800/80 dark:bg-[#121212] dark:focus:ring-[#f2c14e]/30"
      >
        {mediaUrl ? (
          isVideo ? (
            <div className="relative h-full w-full">
              <video
                src={mediaUrl}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                muted
                playsInline
                preload="metadata"
                disablePictureInPicture
              />
              <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-md bg-black/60 text-white backdrop-blur-xs">
                <Play size={10} className="fill-white translate-x-0.5" />
              </div>
            </div>
          ) : (
            <img
              src={mediaUrl}
              alt={post.caption || "Post"}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          )
        ) : (
          <div className="flex h-full w-full flex-col justify-between bg-neutral-50 p-3 dark:bg-[#141414]">
            <p className="line-clamp-4 text-[11px] font-medium leading-snug text-[#1c1d1a]/80 dark:text-neutral-300">
              {post.caption || "Civic report"}
            </p>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#3d654c] dark:text-[#f2c14e]">
              Text Report
            </span>
          </div>
        )}

        {meta && (
          <div className="absolute left-2 right-2 top-2 truncate rounded-md bg-black/65 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white backdrop-blur-xs">
            {meta}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
          <p className="truncate text-[10px] font-bold text-white">
            {meta ? "Original: " : ""}@{post.username || "user"}
          </p>
        </div>

        <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/50 opacity-0 backdrop-blur-2xs transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex items-center gap-1 text-xs font-black text-white">
            <Heart size={13} className="fill-white" />
            {post.likes || 0}
          </span>
          <span className="flex items-center gap-1 text-xs font-black text-white">
            <MessageSquare size={13} className="fill-white" />
            {post.comments || 0}
          </span>
          <span className="flex items-center gap-1 text-xs font-black text-white">
            <Repeat2 size={13} />
            {post.reHives || 0}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#f7f7f2] font-sans text-[#1c1d1a] selection:bg-[#3d654c]/20 selection:text-[#2d4d38] dark:bg-[#0a0a0a] dark:text-neutral-100 pb-20">
      {/* Top Bar for visiting other profiles */}
      {!isOwnProfile && (
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#1c1d1a]/10 bg-[#f7f7f2]/90 px-4 py-3 backdrop-blur-md dark:border-neutral-800/80 dark:bg-[#0a0a0a]/90">
          <button
            onClick={() => navigate(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-white text-[#1c1d1a] shadow-2xs transition hover:bg-[#ecece5] dark:border-neutral-800 dark:bg-[#121212] dark:text-white dark:hover:bg-neutral-800"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="text-center">
            <h2 className="text-xs font-black tracking-tight text-[#1c1d1a] dark:text-white">
              {profile.displayName || "Citizen"}
            </h2>
            <p className="text-[10px] font-bold text-[#3d654c] dark:text-[#f2c14e]">
              @{profile.username}
            </p>
          </div>
          <div className="w-8" />
        </div>
      )}

      {/* Ambient Header Banner */}
      <div className="relative h-28 md:h-32 w-full bg-gradient-to-r from-[#e5ebe3] via-[#f7f7f2] to-[#e8efe6] dark:from-[#111] dark:via-[#161616] dark:to-[#0d0d0d] border-b border-[#1c1d1a]/5 dark:border-neutral-900 overflow-hidden">
        {profile.bannerURL ? (
          <img
            src={profile.bannerURL}
            alt={`${profile.displayName}'s banner`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(#3d654c_1px,transparent_1px)] dark:bg-[radial-gradient(#f2c14e_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
        )}
      </div>

      {/* Profile Header Container */}
      <div className="px-4 md:px-6 w-full -mt-12 space-y-4">
        {/* Avatar + Action Row */}
        <div className="flex items-end justify-between gap-4">
          {/* Circular Avatar */}
          <div className="relative shrink-0">
            <img
              src={profile.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=3d654c&color=fff"}
              alt={profile.username}
              className="h-24 w-24 md:h-28 md:w-28 rounded-full border-4 border-[#f7f7f2] object-cover shadow-sm dark:border-[#0a0a0a]"
            />
            <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#3d654c] text-white shadow-xs dark:bg-[#f2c14e] dark:text-[#121212]">
              <Sparkles size={11} />
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pb-1">
            {isOwnProfile ? (
              <>
                <button
                  onClick={() => navigate("/profile/edit")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#1c1d1a]/15 bg-white px-4 py-2 text-xs font-bold text-[#1c1d1a] shadow-2xs transition hover:bg-[#ecece5] dark:border-neutral-700 dark:bg-[#141414] dark:text-white dark:hover:bg-neutral-800"
                >
                  <Settings size={14} /> Edit Profile
                </button>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: profile.displayName, url: window.location.href });
                    }
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1c1d1a]/15 bg-white text-[#1c1d1a] shadow-2xs transition hover:bg-[#ecece5] dark:border-neutral-700 dark:bg-[#141414] dark:text-white dark:hover:bg-neutral-800"
                  title="Share"
                >
                  <Share2 size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={toggleFollow}
                  disabled={followBusy}
                  className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-xs font-bold shadow-xs transition ${
                    following
                      ? "border border-[#1c1d1a]/15 bg-white text-[#1c1d1a] hover:bg-neutral-100 dark:border-neutral-700 dark:bg-[#141414] dark:text-white"
                      : "bg-[#3d654c] text-white hover:bg-[#32533e] dark:bg-[#f2c14e] dark:text-[#121212] dark:hover:bg-[#dfb041]"
                  }`}
                >
                  {followBusy
                    ? "Updating..."
                    : following
                    ? "Following"
                    : followRequestPending
                    ? "Requested"
                    : "Follow"}
                </button>
                <button
                  onClick={() => navigate("/chats")}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1c1d1a]/15 bg-white text-[#1c1d1a] shadow-2xs transition hover:bg-[#ecece5] dark:border-neutral-700 dark:bg-[#141414] dark:text-white"
                >
                  <MessageCircle size={15} />
                </button>
                <button
                  onClick={toggleFollow}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#1c1d1a]/15 bg-white text-[#1c1d1a] shadow-2xs transition hover:bg-[#ecece5] dark:border-neutral-700 dark:bg-[#141414] dark:text-white"
                >
                  <UserPlus size={15} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* User Details */}
        <div className="space-y-2 pt-1">
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-[#1c1d1a] dark:text-white">
                {profile.displayName || "Hivez Contributor"}
              </h1>
              {profile.verified && (
                <BadgeCheck size={18} className="text-[#3d654c] dark:text-[#f2c14e]" />
              )}
            </div>
            <p className="text-xs font-bold text-[#1c1d1a]/50 dark:text-neutral-400">
              @{profile.username}
            </p>
          </div>

          {profile.bio && (
            <p className="text-xs font-medium leading-relaxed text-[#1c1d1a]/85 dark:text-neutral-300 whitespace-pre-wrap">
              {profile.bio}
            </p>
          )}

          {/* Civic Badges */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-bold text-[#1c1d1a]/60 dark:text-neutral-400">
            <span className="inline-flex items-center gap-1 rounded-md bg-[#3d654c]/10 px-2 py-0.5 text-[10px] text-[#3d654c] dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              <ShieldCheck size={11} /> Verified Citizen
            </span>
            <span className="inline-flex items-center gap-1 text-[10px]">
              <Calendar size={11} /> Active Contributor
            </span>
            <span className="inline-flex items-center gap-1 text-[10px]">
              <Lock size={11} /> {privacy.account === "private" ? "Private Account" : "Public Account"}
            </span>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-5 pt-2 text-xs font-medium text-[#1c1d1a]/70 dark:text-neutral-400">
            <div>
              <strong className="font-extrabold text-[#1c1d1a] dark:text-white">{profile.posts || 0}</strong>{" "}
              <span>Posts</span>
            </div>
            <div>
              <strong className="font-extrabold text-[#1c1d1a] dark:text-white">{profile.followers || 0}</strong>{" "}
              <span>Followers</span>
            </div>
            <div>
              <strong className="font-extrabold text-[#1c1d1a] dark:text-white">{profile.following || 0}</strong>{" "}
              <span>Following</span>
            </div>
          </div>
        </div>

        {localError && (
          <p className="rounded-xl bg-rose-50 p-2.5 text-center text-xs font-bold text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            {localError}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="w-full px-4 md:px-6 mt-6 border-b border-[#1c1d1a]/10 dark:border-neutral-800">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex flex-1 items-center justify-center gap-2 py-3 px-4 text-xs font-bold transition-all duration-150 ${
                  isActive
                    ? "text-[#3d654c] dark:text-[#f2c14e]"
                    : "text-[#1c1d1a]/50 hover:text-[#1c1d1a] dark:text-neutral-400 dark:hover:text-white"
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3d654c] dark:bg-[#f2c14e] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Grid Body */}
      <div className="w-full px-4 md:px-6 pt-4">
        {activeTab === "posts" && (
          <>
            {!canViewProtectedContent ? (
              renderProtectedState()
            ) : postsLoading ? (
              <div className="flex min-h-[220px] items-center justify-center py-16">
                <HivezLoader size="md" progress={58} label="Loading profile posts" />
              </div>
            ) : userPosts.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                {userPosts.map((post) => renderPostTile(post))}
              </div>
            ) : (
              renderEmptyState(
                "posts",
                "No posts published yet",
                isOwnProfile ? "Your published reports and updates will appear here." : "This user hasn't published any posts yet."
              )
            )}
          </>
        )}

        {activeTab === "rehives" && (
          <>
            {!canViewProtectedContent ? (
              renderProtectedState()
            ) : reHivesLoading ? (
              <div className="flex min-h-[220px] items-center justify-center py-16">
                <HivezLoader size="md" progress={58} label="Loading ReHives" />
              </div>
            ) : reHivePosts.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                {reHivePosts.map((post) => renderPostTile(post, `ReHived by @${profile.username}`))}
              </div>
            ) : (
              renderEmptyState(
                "rehives",
                "No ReHives yet",
                isOwnProfile ? "Posts you ReHive will appear here with original attribution." : "This user hasn't ReHived any posts yet."
              )
            )}
          </>
        )}

        {activeTab === "media" && (
          <>
            {!canViewProtectedContent ? (
              renderProtectedState()
            ) : postsLoading ? (
              <div className="flex min-h-[220px] items-center justify-center py-16">
                <HivezLoader size="md" progress={58} label="Loading media" />
              </div>
            ) : mediaPosts.length > 0 ? (
              <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                {mediaPosts.map((post) => renderPostTile(post))}
              </div>
            ) : (
              renderEmptyState(
                "media",
                "No media records",
                isOwnProfile ? "Uploaded photos and videos will be indexed here." : "No media submissions found."
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
