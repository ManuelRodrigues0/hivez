import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  Settings,
  BadgeCheck,
} from "lucide-react";

import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";

interface UserProfile {
  displayName: string;
  username: string;
  bio: string;
  photoURL: string;
  verified: boolean;
}

export default function ProfileHeader() {
  const { user } = useAuth();

  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user) return;

      const snap = await getDoc(
        doc(db, "users", user.uid)
      );

      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
    }

    loadProfile();
  }, [user]);

  if (!profile) {
    return (
      <div className="flex justify-center py-20 text-zinc-500">
        Loading profile...
      </div>
    );
  }

  return (
    <header className="border-b border-zinc-800 px-5 pt-8 pb-6">

      <div className="flex items-start justify-between">

        <div>

          <h1 className="flex items-center gap-2 text-3xl font-bold">

            {profile.displayName || "Hivez User"}

            {profile.verified && (
              <BadgeCheck
                size={22}
                className="text-sky-500"
              />
            )}

          </h1>

          <p className="mt-1 text-zinc-400">
            @{profile.username}
          </p>

        </div>

        <button className="rounded-full p-2 hover:bg-zinc-900">

          <Settings size={22} />

        </button>

      </div>

      <div className="mt-6 flex items-center justify-between">

        <div className="flex-1">

          <p className="max-w-xs whitespace-pre-wrap text-[15px] leading-6">
            {profile.bio || "No bio yet."}
          </p>

        </div>

        <img
          src={
            profile.photoURL ||
            "https://i.pravatar.cc/300"
          }
          alt="Profile"
          className="h-24 w-24 rounded-full border border-zinc-700 object-cover"
        />

      </div>

    </header>
  );
}