import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, Save } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../firebase/firebase";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";

export default function EditProfile() {
  const { user, refreshProfileStatus } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setDisplayName(data.displayName || "");
          setUsername(data.username || "");
          setOriginalUsername(data.username || "");
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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", "hivez_upload");

      const response = await fetch(
        "https://api.cloudinary.com/v1_1/dpotccr5q/image/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (data.secure_url) {
        setPhotoURL(data.secure_url);
      } else {
        throw new Error("Upload failed");
      }
    } catch (err) {
      console.error("Failed to upload image:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!user) return;
    if (!displayName.trim()) {
      alert("Display name is required.");
      return;
    }

    const cleanUsername = username.trim().replace(/^@+/, "").toLowerCase();

    if (cleanUsername.length < 3) {
      alert("Username must be at least 3 characters.");
      return;
    }

    setSaving(true);

    try {
      // Check if username has changed
      const usernameChanged = cleanUsername !== originalUsername;

      if (usernameChanged) {
        // Check if the new username is already taken
        const usernameDoc = await getDoc(doc(db, "usernames", cleanUsername));
        if (usernameDoc.exists()) {
          alert("Username already taken. Please choose another.");
          setSaving(false);
          return;
        }

        // Delete the old username entry if it exists
        if (originalUsername) {
          await deleteDoc(doc(db, "usernames", originalUsername));
        }

        // Create the new username entry
        await setDoc(doc(db, "usernames", cleanUsername), {
          uid: user.uid,
        });
      }

      // Update the user document
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: displayName.trim(),
          username: cleanUsername,
          bio: bio.trim(),
          photoURL,
        },
        { merge: true }
      );

      // Update originalUsername to reflect the change
      setOriginalUsername(cleanUsername);

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
    <div className="app-page">
      {/* Header */}
      <div className="app-sticky-header">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="app-icon-button"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-semibold">Edit Profile</h1>
          <button
            onClick={save}
            disabled={saving}
            className="app-primary-button py-1.5"
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
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
            >
              {uploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent dark:border-black" />
              ) : (
                <Camera size={14} />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
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
              className="app-field"
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
                className="app-field pl-8"
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
              className="app-field resize-none"
            />
            <p className="mt-1 text-right text-xs text-zinc-400">{bio.length}/160</p>
          </div>

          {/* Profile Picture URL - Optional fallback */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Profile Picture URL <span className="text-zinc-400">(optional - use upload instead)</span>
            </label>
            <input
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="app-field"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
