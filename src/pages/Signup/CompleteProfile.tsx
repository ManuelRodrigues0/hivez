import { useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";

export default function CompleteProfile() {
  const { user, refreshProfileStatus } = useAuth();

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  async function saveProfile() {
    if (!user) return;

    setUsernameError("");

    const rawUsername = username.trim();
    // Strip @ if user typed it in the username field
    const cleanUsername = rawUsername.replace(/^@+/, "").toLowerCase();

    if (cleanUsername.length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      return;
    }

    setLoading(true);

    const usernameDoc = await getDoc(
      doc(db, "usernames", cleanUsername)
    );

    if (usernameDoc.exists()) {
      setUsernameError("Username already taken.");
      setLoading(false);
      return;
    }

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          username: cleanUsername,
          bio,
          profileCompleted: true,
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "usernames", cleanUsername),
        {
          uid: user.uid,
        }
      );

      await refreshProfileStatus();
    } catch (err: any) {
      setUsernameError(err.message || "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-bg flex min-h-screen items-center justify-center px-6 text-white">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-3xl font-black tracking-tight text-white drop-shadow-lg">
          Complete Profile
        </h1>
        <p className="mb-8 text-center text-sm text-zinc-200 drop-shadow">Choose the identity people will see in the feed.</p>

        <div className="app-surface space-y-4 p-4">
          <div>
            <input
              className="app-field"
              placeholder="Username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setUsernameError("");
              }}
            />
            {usernameError && (
              <p className="mt-1.5 text-xs text-red-500">{usernameError}</p>
            )}
          </div>

          <textarea
            className="app-field h-28 resize-none"
            placeholder="Bio"
            value={bio}
            onChange={(e) =>
              setBio(e.target.value)
            }
          />

          <button
            onClick={saveProfile}
            disabled={loading}
            className="app-primary-button w-full py-3"
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
