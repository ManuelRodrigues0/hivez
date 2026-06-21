import { useEffect, useState } from "react";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";

interface UserProfile {
  posts: number;
  followers: number;
  following: number;
}

export default function ProfileStats() {
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

  if (!profile) return null;

  return (
    <section className="px-5 py-6">

      <div className="grid grid-cols-3 text-center">

        <div>
          <h2 className="text-2xl font-bold">
            {profile.posts}
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            Posts
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold">
            {profile.followers}
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            Followers
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold">
            {profile.following}
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            Following
          </p>
        </div>

      </div>

    </section>
  );
}