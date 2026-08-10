import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, MessageCircle, UserPlus, Settings, Share2 } from "lucide-react";
import { doc, deleteDoc, getDoc, increment, onSnapshot, query, where, writeBatch, collection } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import { createNotification } from "@/services/notifications";
import { createFollowRequest, listenToSentFollowRequests } from "@/services/followRequests";
import type { FeedPost } from "../../components/feed/Feed";

interface UserProfile {
  uid: string;
  displayName: string;
  username: string;
  bio: string;
  photoURL: string;
  verified: boolean;
  posts: number;
  followers: number;
  following: number;
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
  const [activeTab, setActiveTab] = useState<"posts" | "replies" | "media">("posts");
  const [localError, setLocalError] = useState<string | null>(null);
  const [userPosts, setUserPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const isOwnProfile = !uid || uid === currentUser?.uid;
  const profileUid = isOwnProfile ? currentUser?.uid : uid;

  useEffect(() => {
    async function loadProfile() {
      if (!profileUid) {
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "users", profileUid));
        if (snap.exists()) {
          setProfile({ uid: snap.id, ...snap.data() } as UserProfile);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [profileUid]);

  // Fetch user posts
  useEffect(() => {
    if (!profileUid) {
      setPostsLoading(false);
      return;
    }

    setPostsLoading(true);
    // Only use where clause to avoid needing a composite index
    // Sort client-side instead
    const q = query(
      collection(db, "posts"),
      where("uid", "==", profileUid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const posts: FeedPost[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<FeedPost, "id">),
      }));
      
      // Sort client-side by createdAt (descending)
      posts.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.()?.getTime?.() || 0;
        const bTime = b.createdAt?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
      });
      
      setUserPosts(posts);
      setPostsLoading(false);
    }, (error) => {
      console.error("Error fetching user posts:", error);
      setPostsLoading(false);
    });

    return () => unsubscribe();
  }, [profileUid]);

  useEffect(() => {
    if (!currentUser || !profileUid || isOwnProfile) {
      setFollowing(false);
      setFollowRequestPending(false);
      return;
    }

    // Subscribe to follow relationship
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

    // Subscribe to sent follow requests
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

    // Subscribe to profile user document for real-time count updates
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
    console.log("=== TOGGLE FOLLOW CLICKED ===");
    console.log("Current user:", currentUser?.uid);
    console.log("Profile user:", profile?.uid);
    console.log("Is own profile:", isOwnProfile);
    console.log("Currently following:", following);
    console.log("Request pending:", followRequestPending);
    console.log("Follow busy:", followBusy);
    
    if (!currentUser || !profile || isOwnProfile || followBusy) {
      console.log("Early return - conditions not met");
      return;
    }
    
    setFollowBusy(true);
    setLocalError(null);

    try {
      if (following) {
        console.log("Unfollowing...");
        // Unfollow
        const followRef = doc(db, "follows", `${currentUser.uid}_${profile.uid}`);
        const followerRef = doc(db, "users", profile.uid, "followers", currentUser.uid);
        const followingRef = doc(db, "users", currentUser.uid, "following", profile.uid);
        const batch = writeBatch(db);

        batch.delete(followRef);
        batch.delete(followerRef);
        batch.delete(followingRef);
        batch.update(doc(db, "users", profile.uid), { followers: increment(-1) });
        batch.update(doc(db, "users", currentUser.uid), { following: increment(-1) });

        await batch.commit();
        console.log("Unfollow successful");

        // Optimistically update UI
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
        console.log("Canceling pending request...");
        // Cancel pending request
        const requestRef = doc(db, "followRequests", `${currentUser.uid}_${profile.uid}`);
        await deleteDoc(requestRef);
        setFollowRequestPending(false);
        console.log("Request canceled");
      } else {
        console.log("Sending follow request...");
        // Send follow request
        await createFollowRequest(currentUser.uid, profile.uid);
        console.log("Follow request created");
        
        // Optimistically update UI
        setFollowRequestPending(true);

        // Send notification
        console.log("Sending notification...");
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
        console.log("Notification sent - FOLLOW REQUEST COMPLETE");
      }
    } catch (error: any) {
      console.error("=== ERROR IN TOGGLE FOLLOW ===");
      console.error("Error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      setLocalError(`Failed: ${error.message}`);
    } finally {
      setFollowBusy(false);
      console.log("=== TOGGLE FOLLOW COMPLETE ===");
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-full items-center justify-center py-32 text-center">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">User not found</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">This profile doesn't exist.</p>
          <button onClick={() => navigate(-1)} className="mt-4 text-sm text-sky-500 hover:underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "posts" as const, label: "Posts" },
    { key: "replies" as const, label: "Replies" },
    { key: "media" as const, label: "Media" },
  ];

  return (
    <div className="app-page app-profile-page">
      {/* Desktop-only minimalist profile layout */}
      <div className="hidden lg:block">
        {/* Header with back button */}
        {!isOwnProfile && (
          <div className="flex items-center gap-4 px-8 py-4">
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <ArrowLeft size={18} />
              Back
            </button>
          </div>
        )}

        {/* Profile Header */}
        <div className="border-b border-zinc-200 px-8 pb-8 pt-6 dark:border-zinc-800">
          <div className="flex items-start justify-between">
            {/* Profile Picture */}
            <div className="relative">
              <img
                src={profile.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"}
                alt={profile.username}
                className="h-24 w-24 rounded-full border border-zinc-200 object-cover dark:border-zinc-700"
              />
              {profile.verified && (
                <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-sky-500 p-1">
                  <BadgeCheck size={16} className="text-white" />
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {isOwnProfile ? (
                <>
                  <button 
                    onClick={() => navigate("/profile/edit")}
                    className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800"
                  >
                    <Settings size={16} className="inline-block mr-1.5" />
                    Edit Profile
                  </button>
                  <button className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800">
                    <Share2 size={16} className="inline-block mr-1.5" />
                    Share
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={toggleFollow} 
                    disabled={followBusy}
                    className={`rounded-lg border px-5 py-2 text-sm font-medium transition ${
                      following 
                        ? "border-zinc-300 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800" 
                        : "border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 dark:border-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                    }`}
                  >
                    {followBusy ? "Loading..." : following ? "Following" : followRequestPending ? "Requested" : "Follow"}
                  </button>
                  <button className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800">
                    <MessageCircle size={18} />
                  </button>
                  <button className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-white dark:hover:bg-zinc-800">
                    <UserPlus size={18} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="mt-5">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {profile.displayName || "Hivez User"}
              </h1>
            </div>
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">@{profile.username}</p>
          </div>

          {profile.bio && (
            <p className="mt-3 max-w-xl whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {profile.bio}
            </p>
          )}

          {/* Stats */}
          <div className="mt-5 flex items-center gap-6 text-sm">
            <span className="text-zinc-900 dark:text-white"><strong>{profile.posts}</strong> <span className="text-zinc-500 dark:text-zinc-400">posts</span></span>
            <span className="text-zinc-900 dark:text-white"><strong>{profile.followers}</strong> <span className="text-zinc-500 dark:text-zinc-400">followers</span></span>
            <span className="text-zinc-900 dark:text-white"><strong>{profile.following}</strong> <span className="text-zinc-500 dark:text-zinc-400">following</span></span>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-16 z-20 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "border-b-2 border-zinc-900 text-zinc-900 dark:border-white dark:text-white"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {activeTab === "posts" && (
          <>
            {postsLoading ? (
              <div className="flex min-h-[300px] items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" />
              </div>
            ) : userPosts.length > 0 ? (
              <div className="grid grid-cols-3 gap-1 p-4">
                {userPosts.map((post) => {
                  const mediaUrl = post.mediaItems?.[0]?.url || post.mediaUrls?.[0] || post.mediaUrl;
                  const isVideo = post.mediaItems?.[0]?.type === "video" || post.mediaType === "video";
                  
                  return (
                    <div key={post.id} className="group relative aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <button
                        onClick={() => navigate(`/post/${post.id}`)}
                        className="h-full w-full"
                      >
                        {mediaUrl ? (
                          isVideo ? (
                            <video
                              src={mediaUrl}
                              className="h-full w-full object-cover transition group-hover:opacity-80"
                              muted
                            />
                          ) : (
                            <img
                              src={mediaUrl}
                              alt={post.caption || "Post"}
                              className="h-full w-full object-cover transition group-hover:opacity-80"
                            />
                          )
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-4">
                            <p className="line-clamp-4 text-center text-xs text-zinc-500 dark:text-zinc-400">
                              {post.caption || "No content"}
                            </p>
                          </div>
                        )}
                        {/* Hover overlay with stats */}
                        <div className="absolute inset-0 flex items-center justify-center gap-4 bg-black/60 opacity-0 transition group-hover:opacity-100">
                          <span className="flex items-center gap-1 text-sm font-semibold text-white">
                            <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
                              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                            {post.likes}
                          </span>
                          <span className="flex items-center gap-1 text-sm font-semibold text-white">
                            <svg className="h-4 w-4 fill-white" viewBox="0 0 24 24">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                            </svg>
                            {post.comments}
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-[300px] items-center justify-center py-16">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-white">No posts yet</h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {isOwnProfile ? "Your posts will appear here." : "This user hasn't posted anything yet."}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "replies" && (
          <div className="flex min-h-[300px] items-center justify-center py-16">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">No replies yet</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {isOwnProfile ? "Your replies will appear here." : "This user hasn't replied to anything yet."}
              </p>
            </div>
          </div>
        )}

        {activeTab === "media" && (
          <div className="flex min-h-[300px] items-center justify-center py-16">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <svg className="h-6 w-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-white">No media yet</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {isOwnProfile ? "Your media will appear here." : "This user hasn't shared any media yet."}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile layout (unchanged) */}
      <div className="lg:hidden">
        {/* Header with back button */}
        {!isOwnProfile && (
          <div className="app-sticky-header">
            <div className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => navigate(-1)} className="app-icon-button">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-base font-semibold">{profile.displayName || "Profile"}</h1>
            </div>
          </div>
        )}

        {/* Profile Info */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-zinc-900 dark:text-white">{profile.displayName || "Hivez User"}</h1>
                {profile.verified && <BadgeCheck size={18} className="text-sky-500" />}
              </div>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">@{profile.username}</p>
            </div>
            <img
              src={profile.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"}
              alt={profile.username}
              className="h-20 w-20 flex-shrink-0 rounded-full border-2 border-zinc-200 object-cover dark:border-zinc-700"
            />
          </div>

          {profile.bio && (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-zinc-700 dark:text-zinc-300">{profile.bio}</p>
          )}

          {/* Stats */}
          <div className="mt-4 flex items-center gap-5 text-sm">
            <span><strong className="text-zinc-900 dark:text-white">{profile.posts}</strong> <span className="text-zinc-500 dark:text-zinc-400">posts</span></span>
            <span><strong className="text-zinc-900 dark:text-white">{profile.followers}</strong> <span className="text-zinc-500 dark:text-zinc-400">followers</span></span>
            <span><strong className="text-zinc-900 dark:text-white">{profile.following}</strong> <span className="text-zinc-500 dark:text-zinc-400">following</span></span>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex gap-2">
            {isOwnProfile ? (
              <>
                <button onClick={() => navigate("/profile/edit")} className="app-secondary-button flex-1">
                  Edit Profile
                </button>
                <button className="app-secondary-button flex-1">
                  Share Profile
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={toggleFollow} 
                  disabled={followBusy} 
                  className="app-primary-button flex-1"
                >
                  {followBusy ? "Loading..." : following ? "Following" : followRequestPending ? "Requested" : "Follow"}
                </button>
                <button className="app-secondary-button px-3">
                  <MessageCircle size={18} />
                </button>
                <button className="app-secondary-button px-3">
                  <UserPlus size={18} />
                </button>
              </>
            )}
          </div>
          {localError && (
            <p className="mt-2 text-sm text-red-500">{localError}</p>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`app-tab ${activeTab === tab.key ? "app-tab-active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {activeTab === "posts" && (
          <>
            {postsLoading ? (
              <div className="flex min-h-[200px] items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-white" />
              </div>
            ) : userPosts.length > 0 ? (
              <div className="grid grid-cols-3 gap-0.5">
                {userPosts.map((post) => {
                  const mediaUrl = post.mediaItems?.[0]?.url || post.mediaUrls?.[0] || post.mediaUrl;
                  const isVideo = post.mediaItems?.[0]?.type === "video" || post.mediaType === "video";
                  
                  return (
                    <button
                      key={post.id}
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="group relative aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800"
                    >
                      {mediaUrl ? (
                        isVideo ? (
                          <video
                            src={mediaUrl}
                            className="h-full w-full object-cover"
                            muted
                          />
                        ) : (
                          <img
                            src={mediaUrl}
                            alt={post.caption || "Post"}
                            className="h-full w-full object-cover"
                          />
                        )
                      ) : (
                        <div className="flex h-full w-full items-center justify-center p-2">
                          <p className="line-clamp-3 text-center text-[10px] text-zinc-500 dark:text-zinc-400">
                            {post.caption || "No content"}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="app-empty-state">
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">No posts yet</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {isOwnProfile ? "Your posts will appear here." : "This user hasn't posted anything yet."}
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === "replies" && (
          <div className="app-empty-state">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">No replies yet</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {isOwnProfile ? "Your replies will appear here." : "This user hasn't replied to anything yet."}
            </p>
          </div>
        )}

        {activeTab === "media" && (
          <div className="app-empty-state">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-white">No media yet</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {isOwnProfile ? "Your media will appear here." : "This user hasn't shared any media yet."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
