import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";
import { Shield, Lock } from "lucide-react";

const ADMIN_PASSWORD = "ChrisBhumi";

export default function AdminSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [setting, setSetting] = useState(false);
  const [done, setDone] = useState(false);

  function handleUnlock() {
    if (password === ADMIN_PASSWORD) {
      setUnlocked(true);
      setPasswordError("");
    } else {
      setPasswordError("Wrong password");
    }
  }

  async function makeAdmin() {
    if (!user) return;
    setSetting(true);
    try {
      await setDoc(doc(db, "users", user.uid), { role: "admin" }, { merge: true });
      setDone(true);
    } catch (err) {
      alert("Failed: " + (err as any).message);
    }
    setSetting(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
      <div className="w-full max-w-sm text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-amber-400" />
        <h1 className="mb-2 text-2xl font-black">Admin Setup</h1>

        {!user ? (
          <p className="text-sm text-zinc-400">
            You need to <a href="/login" className="text-white underline">log in</a> first.
          </p>
        ) : done ? (
          <div>
            <p className="mb-4 text-sm text-green-400">✅ You are now an admin!</p>
            <button
              onClick={() => navigate("/admin")}
              className="rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-black"
            >
              Go to Admin Panel
            </button>
          </div>
        ) : !unlocked ? (
          <div>
            <Lock className="mx-auto mb-3 h-8 w-8 text-zinc-500" />
            <p className="mb-4 text-sm text-zinc-400">Enter the admin setup password</p>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder="Password"
              className="mb-3 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none focus:border-zinc-600"
            />
            {passwordError && <p className="mb-3 text-xs text-red-400">{passwordError}</p>}
            <button
              onClick={handleUnlock}
              className="w-full rounded-full bg-white py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Unlock
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-6 text-sm text-zinc-400">
              Logged in as <span className="text-white">{user.email}</span>
            </p>
            <button
              onClick={makeAdmin}
              disabled={setting}
              className="w-full rounded-full bg-white py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
            >
              {setting ? "Setting..." : "Make me Admin"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
