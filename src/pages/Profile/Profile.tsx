import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, MessageCircle, UserPlus, Settings, Share2 } from "lucide-react";
import { doc, deleteDoc, getDoc, increment, onSnapshot, writeBatch } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import { createNotification } from "@/services/notifications";
import { createFollowRequest, listenToSentFollowRequests } from "@/services/followRequests";

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
  const [activeTab, setActiveTab] = useState<"threads" | "replies" | "media">("threads");
  const [localError, setLocalError] = useState<string | null>(null);

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
    { key: "threads" as const, label: "Threads" },
    { key: "replies" as const, label: "Replies" },
    { key: "media" as const, label: "Media" },
  ];

  return (
    <div className="app-page">
      {/* Desktop-only modern profile layout */}
      <div className="hidden lg:block">
        {/* Hero Section with gradient background */}
        <div className="relative overflow-hidden bg-gradient-to-br from-sky-500/10 via-purple-500/5 to-pink-500/10 dark:from-sky-500/20 dark:via-purple-500/10 dark:to-pink-500/20">
          {/* Decorative elements */}
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          
          {/* Header with back button */}
          {!isOwnProfile && (
            <div className="relative z-10 flex items-center gap-4 px-8 py-4">
              <button 
                onClick={() => navigate(-1)} 
                className="group flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-zinc-700 backdrop-blur-sm transition-all hover:bg-white hover:shadow-md dark:bg-zinc-800/80 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
                Back
              </button>
            </div>
          )}

          {/* Profile Header Section */}
          <div className="relative z-10 px-8 pb-8 pt-6">
            <div className="flex items-start justify-between">
              {/* Profile Picture with ring */}
              <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-sky-500 to-purple-600 opacity-75 blur-sm"></div>
                <div className="relative rounded-full bg-white p-1 dark:bg-zinc-900">
                  <img
                    src={profile.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"}
                    alt={profile.username}
                    className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-xl dark:border-zinc-900"
                  />
                </div>
                {profile.verified && (
                  <div className="absolute -bottom-1 -right-1 rounded-full bg-sky-500 p-2 shadow-lg">
                    <BadgeCheck size={20} className="text-white" />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {isOwnProfile ? (
                  <>
                    <button 
                      onClick={() => navigate("/profile/edit")}
                      className="group flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:bg-zinc-800 hover:shadow-xl dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                    >
                      <Settings size={18} />
                      Edit Profile
                    </button>
                    <button className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-zinc-900 shadow-md transition-all hover:shadow-lg dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700">
                      <Share2 size={18} />
                      Share
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={toggleFollow} 
                      disabled={followBusy}
                      className={`group flex items-center gap-2 rounded-full px-8 py-2.5 text-sm font-semibold shadow-lg transition-all hover:shadow-xl ${
                        following 
                          ? "bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700" 
                          : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                      }`}
                    >
                      {followBusy ? "Loading..." : following ? "Following" : followRequestPending ? "Requested" : "Follow"}
                    </button>
                    <button className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-zinc-900 shadow-md transition-all hover:shadow-lg dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700">
                      <MessageCircle size={18} />
                    </button>
                    <button className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-zinc-900 shadow-md transition-all hover:shadow-lg dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700">
                      <UserPlus size={18} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Profile Info */}
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                  {profile.displayName || "Hivez User"}
                </h1>
              </div>
              <p className="mt-1 text-base text-zinc-500 dark:text-zinc-400">@{profile.username}</p>
            </div>

            {profile.bio && (
              <p className="mt-4 max-w-2xl whitespace-pre-wrap text-base leading-7 text-zinc-700 dark:text-zinc-300">
                {profile.bio}
              </p>
            )}

            {/* Stats */}
            <div className="mt-6 flex items-center gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{profile.posts}</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">Posts</div>
              </div>
              <div className="h-8 w-px bg-zinc-300 dark:bg-zinc-700"></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{profile.followers}</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">Followers</div>
              </div>
              <div className="h-8 w-px bg-zinc-300 dark:bg-zinc-700"></div>
              <div className="text-center">
                <div className="text-2xl font-bold text-zinc-900 dark:text-white">{profile.following}</div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400">Following</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="sticky top-16 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/95">
          <div className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-1 py-4 text-sm font-semibold transition-all ${
                  activeTab === tab.key
                    ? "text-zinc-900 dark:text-white"
                    : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-500 to-purple-600"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex min-h-[400px] items-center justify-center py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">No {activeTab} yet</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {isOwnProfile ? "Your posts will appear here." : "This user hasn't posted anything yet."}
            </p>
          </div>
        </div>
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
        <div className="app-empty-state">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">No {activeTab} yet</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {isOwnProfile ? "Your posts will appear here." : "This user hasn't posted anything yet."}
          </p>
        </div>
      </div>
    </div>
  );
}
