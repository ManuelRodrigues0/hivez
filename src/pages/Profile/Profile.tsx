import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, MessageCircle, UserPlus } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";

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
    <div className="min-h-full">
      {/* Header with back button */}
      {!isOwnProfile && (
        <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => navigate(-1)} className="rounded-full p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
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
              <button
                onClick={() => navigate("/profile/edit")}
                className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Edit Profile
              </button>
              <button className="flex-1 rounded-lg border border-zinc-300 py-2 text-sm font-medium transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                Share Profile
              </button>
            </>
          ) : (
            <>
              <button className="flex-1 rounded-lg bg-black py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                Follow
              </button>
              <button className="rounded-lg border border-zinc-300 p-2 transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
                <MessageCircle size={18} />
              </button>
              <button className="rounded-lg border border-zinc-300 p-2 transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
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
              className={`flex-1 py-3 text-center text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                  : "text-zinc-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-white">No {activeTab} yet</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {isOwnProfile ? "Your posts will appear here." : "This user hasn't posted anything yet."}
        </p>
      </div>
    </div>
  );
}