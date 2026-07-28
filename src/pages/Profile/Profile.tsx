import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, MessageCircle, UserPlus } from "lucide-react";
import { doc, deleteDoc, getDoc, increment, onSnapshot, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import { createNotification } from "@/services/notifications";
import { createFollowRequest, checkFollowRequestStatus } from "@/services/followRequests";

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

    const followUnsub = onSnapshot(doc(db, "follows", `${currentUser.uid}_${profileUid}`), (snap) => {
      setFollowing(snap.exists());
    });

    const checkRequestStatus = async () => {
      const status = await checkFollowRequestStatus(currentUser.uid, profileUid);
      setFollowRequestPending(status === "pending");
    };

    checkRequestStatus();

    return () => {
      followUnsub();
    };
  }, [currentUser, isOwnProfile, profileUid]);

  async function toggleFollow() {
    if (!currentUser || !profile || isOwnProfile || followBusy) return;
    setFollowBusy(true);

    try {
      if (following) {
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

        setProfile((current) =>
          current
            ? {
                ...current,
                followers: Math.max(0, current.followers - 1),
              }
            : current
        );
      } else if (followRequestPending) {
        // Cancel pending request
        const requestRef = doc(db, "followRequests", `${currentUser.uid}_${profile.uid}`);
        await deleteDoc(requestRef);
        setFollowRequestPending(false);
      } else {
        // Send follow request
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
      }
    } finally {
      setFollowBusy(false);
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
              <button onClick={toggleFollow} disabled={followBusy} className="app-primary-button flex-1">
                {following ? "Following" : followRequestPending ? "Requested" : "Follow"}
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
  );
}
