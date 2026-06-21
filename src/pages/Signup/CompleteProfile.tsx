import { useState } from "react";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";

export default function CompleteProfile() {
  const { user } = useAuth();

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);

  async function saveProfile() {
    if (!user) return;

    const cleanUsername = username.trim().toLowerCase();

    if (cleanUsername.length < 3) {
      alert("Username must be at least 3 characters.");
      return;
    }

    setLoading(true);

    const usernameDoc = await getDoc(
      doc(db, "usernames", cleanUsername)
    );

    if (usernameDoc.exists()) {
      alert("Username already taken.");
      setLoading(false);
      return;
    }

    await updateDoc(doc(db, "users", user.uid), {
      username: cleanUsername,
      bio,
      profileCompleted: true,
    });

    try {
      await updateDoc(
        doc(db, "usernames", cleanUsername),
        {
          uid: user.uid,
        }
      );
    } catch {
      const { setDoc } = await import(
        "firebase/firestore"
      );

      await setDoc(
        doc(db, "usernames", cleanUsername),
        {
          uid: user.uid,
        }
      );
    }

    window.location.replace("/");
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-4xl font-bold">
          Complete Profile
        </h1>

        <input
          className="mb-4 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-4"
          placeholder="Username"
          value={username}
          onChange={(e) =>
            setUsername(e.target.value)
          }
        />

        <textarea
          className="mb-6 h-28 w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-4"
          placeholder="Bio"
          value={bio}
          onChange={(e) =>
            setBio(e.target.value)
          }
        />

        <button
          onClick={saveProfile}
          disabled={loading}
          className="w-full rounded-xl bg-white p-4 font-semibold text-black disabled:opacity-50"
        >
          {loading ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}