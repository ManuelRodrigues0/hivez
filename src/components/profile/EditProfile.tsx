import { useEffect, useState } from "react";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import { db } from "../../firebase/firebase";

import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";

export default function EditProfile() {
  const { user } = useAuth();

  const navigate = useNavigate();

  const [username, setUsername] = useState("");

  const [bio, setBio] = useState("");

  useEffect(() => {
    async function load() {
      if (!user) return;

      const snap = await getDoc(doc(db, "users", user.uid));

      if (snap.exists()) {
        const data = snap.data();

        setUsername(data.displayName || "");
        setBio(data.bio || "");
      }
    }

    load();
  }, [user]);

  async function save() {
    if (!user) return;

    await updateDoc(doc(db, "users", user.uid), {
      displayName: username,
      bio,
    });

    alert("Profile Updated!");

    navigate("/profile");
  }

  return (
    <main className="min-h-screen bg-black px-5 pt-12 text-white">

      <h1 className="mb-8 text-4xl font-bold">
        Edit Profile
      </h1>

      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Username"
        className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-4"
      />

      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder="Bio"
        rows={5}
        className="mb-6 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-4"
      />

      <button
        onClick={save}
        className="w-full rounded-xl bg-white py-4 font-semibold text-black"
      >
        Save
      </button>

    </main>
  );
}