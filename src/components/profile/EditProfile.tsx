import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Save } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function EditProfile() {
  const { user, refreshProfileStatus } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setDisplayName(data.displayName || "");
          setUsername(data.username || "");
          setBio(data.bio || "");
          setPhotoURL(data.photoURL || "");
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  async function save() {
    if (!user) return;
    if (!displayName.trim()) {
      alert("Display name is required.");
      return;
    }
    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: displayName.trim(),
          username: username.trim().replace(/^@+/, "").toLowerCase(),
          bio: bio.trim(),
          photoURL,
        },
        { merge: true }
      );
      await refreshProfileStatus();
      navigate("/profile");
    } catch (err: any) {
      alert(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent dark:border-zinc-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-black/95">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-full p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-semibold">Edit Profile</h1>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-black px-4 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-8 pb-20">
        {/* Avatar */}
        <div className="mb-8 flex justify-center">
          <div className="relative">
            <img
              src={photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"}
              alt="Profile"
              className="h-24 w-24 rounded-full border-2 border-zinc-200 object-cover dark:border-zinc-700"
            />
            <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white dark:bg-white dark:text-black">
              <Camera size={14} />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Display Name</label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/^@+/, ""))}
                placeholder="username"
                className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-8 pr-4 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself"
              rows={4}
              className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-500"
            />
            <p className="mt-1 text-right text-xs text-zinc-400">{bio.length}/160</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Profile Picture URL</label>
            <input
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}