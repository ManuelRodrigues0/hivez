import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, ShieldCheck, AtSign, User, FileText, AlertCircle, Camera, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import HivezLoader from "@/components/common/HivezLoader";
import { db } from "../../firebase/firebase";
import { ProfileImagePicker } from "@/components/profile/ProfileImagePicker";

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
  const [usernameError, setUsernameError] = useState("");
  const [imageError, setImageError] = useState("");
  const [bannerURL, setBannerURL] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerError, setBannerError] = useState("");
  const bannerInputRef = useRef<HTMLInputElement>(null);

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
          setBannerURL(data.bannerURL || "");
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  async function uploadProfileImage(file: File) {
    if (!file || !user) return;

    setUploading(true);
    setImageError("");

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
      setImageError("Profile photo upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleBannerFile(file: File | undefined) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setBannerError("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBannerError("Banner must be smaller than 5MB.");
      return;
    }

    void uploadBannerImage(file);
  }

  async function uploadBannerImage(file: File) {
    if (!file || !user) return;

    setUploadingBanner(true);
    setBannerError("");

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
        setBannerURL(data.secure_url);
      } else {
        throw new Error("Upload failed");
      }
    } catch (err) {
      console.error("Failed to upload banner:", err);
      setBannerError("Banner upload failed. Please try again.");
    } finally {
      setUploadingBanner(false);
    }
  }

  async function save() {
    if (!user) return;
    setUsernameError("");

    if (!displayName.trim()) {
      alert("Display name is required.");
      return;
    }

    const cleanUsername = username.trim().replace(/^@+/, "").toLowerCase();

    if (cleanUsername.length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      return;
    }

    setSaving(true);

    try {
      const usernameChanged = cleanUsername !== originalUsername;

      if (usernameChanged) {
        const usernameDoc = await getDoc(doc(db, "usernames", cleanUsername));
        if (usernameDoc.exists()) {
          setUsernameError("Username already taken. Please choose another.");
          setSaving(false);
          return;
        }

        if (originalUsername) {
          await deleteDoc(doc(db, "usernames", originalUsername));
        }

        await setDoc(doc(db, "usernames", cleanUsername), {
          uid: user.uid,
        });
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: displayName.trim(),
          username: cleanUsername,
          usernameLower: cleanUsername,
          displayNameLower: displayName.trim().toLowerCase(),
          bio: bio.trim(),
          photoURL,
          bannerURL,
        },
        { merge: true }
      );

      setOriginalUsername(cleanUsername);
      await refreshProfileStatus();
      navigate("/profile");
    } catch (err: any) {
      setUsernameError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-32">
        <HivezLoader size="md" progress={58} label="Loading editor" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen px-4 py-5 md:px-8 space-y-6 select-none">
      {/* Top Banner Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1c1d1a]/10 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-white text-[#1c1d1a] shadow-2xs transition hover:bg-[#ecece5] dark:border-neutral-800 dark:bg-[#141414] dark:text-white dark:hover:bg-neutral-800"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-[#1c1d1a] dark:text-white">Edit Profile</h1>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#3d654c] dark:text-[#f2c14e]">
              Public Citizen Identity
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving || uploading || uploadingBanner}
          className="inline-flex items-center gap-2 rounded-xl bg-[#3d654c] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#32533e] disabled:opacity-50 dark:bg-[#f2c14e] dark:text-[#121212] dark:hover:bg-[#dfb041]"
        >
          <Save size={14} />
          <span>{saving ? "Saving..." : "Save Changes"}</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full space-y-6">
        {/* Compact Avatar Card */}
        <div className="w-full rounded-2xl border border-[#1c1d1a]/10 bg-white p-5 shadow-xs dark:border-neutral-800/90 dark:bg-[#121212]">
          <div className="flex items-center justify-between pb-3 border-b border-[#1c1d1a]/5 dark:border-neutral-800/60 mb-4">
            <div className="flex items-center gap-2">
              <Camera size={15} className="text-[#3d654c] dark:text-[#f2c14e]" />
              <h2 className="text-xs font-bold text-[#1c1d1a] dark:text-white">Profile Avatar</h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#3d654c] dark:text-[#f2c14e]">
              Camera / File / Avatar
            </span>
          </div>

          <div className="flex flex-col items-center justify-center [&_.hivez-avatar-picker-preview]:!h-28 [&_.hivez-avatar-picker-preview]:!w-28 [&_img]:!rounded-full [&_.hivez-avatar-preview]:!rounded-full">
            <ProfileImagePicker
              value={photoURL}
              onChange={setPhotoURL}
              onFileSelected={uploadProfileImage}
              onFileError={setImageError}
              onRemove={() => setPhotoURL("")}
              uploading={uploading}
            />
          </div>

          {imageError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
              <AlertCircle size={14} className="shrink-0" />
              <span>{imageError}</span>
            </div>
          )}
        </div>

        {/* Profile Banner Card */}
        <div className="w-full rounded-2xl border border-[#1c1d1a]/10 bg-white p-5 shadow-xs dark:border-neutral-800/90 dark:bg-[#121212]">
          <div className="flex items-center justify-between pb-3 border-b border-[#1c1d1a]/5 dark:border-neutral-800/60 mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon size={15} className="text-[#3d654c] dark:text-[#f2c14e]" />
              <h2 className="text-xs font-bold text-[#1c1d1a] dark:text-white">Profile Banner</h2>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#3d654c] dark:text-[#f2c14e]">
              Background image
            </span>
          </div>

          <div className="relative h-24 md:h-28 w-full overflow-hidden rounded-xl border border-[#1c1d1a]/10 bg-gradient-to-r from-[#e5ebe3] via-[#f7f7f2] to-[#e8efe6] dark:border-neutral-800 dark:from-[#111] dark:via-[#161616] dark:to-[#0d0d0d]">
            {bannerURL ? (
              <img
                src={bannerURL}
                alt="Profile banner preview"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(#3d654c_1px,transparent_1px)] dark:bg-[radial-gradient(#f2c14e_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
            )}
            {uploadingBanner && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="text-[11px] font-bold text-white">Uploading banner...</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#1c1d1a]/15 bg-[#f7f7f2] px-3.5 py-2 text-xs font-bold text-[#1c1d1a] transition hover:bg-[#ecece5] disabled:opacity-50 dark:border-neutral-800 dark:bg-[#181818] dark:text-white dark:hover:bg-neutral-800"
            >
              <Upload size={13} /> Upload banner
            </button>
            {bannerURL && (
              <button
                type="button"
                onClick={() => setBannerURL("")}
                disabled={uploadingBanner}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60"
              >
                <Trash2 size={13} /> Remove banner
              </button>
            )}
            <span className="ml-auto text-[10px] font-semibold text-[#1c1d1a]/40 dark:text-neutral-500">
              JPG / PNG · max 5MB
            </span>
          </div>

          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              handleBannerFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          {bannerError && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-2.5 text-xs font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
              <AlertCircle size={14} className="shrink-0" />
              <span>{bannerError}</span>
            </div>
          )}
        </div>

        {/* Input Fields Card */}
        <div className="w-full rounded-2xl border border-[#1c1d1a]/10 bg-white p-5 shadow-xs dark:border-neutral-800/90 dark:bg-[#121212] space-y-4">
          {/* Display Name */}
          <div className="space-y-1.5">
            <label htmlFor="edit-display-name" className="text-xs font-bold text-[#1c1d1a] dark:text-white flex items-center gap-1.5">
              <User size={13} className="text-[#3d654c] dark:text-[#f2c14e]" /> Display Name
            </label>
            <input
              id="edit-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your public name"
              className="w-full rounded-xl border border-[#1c1d1a]/15 bg-[#f7f7f2] px-3.5 py-2.5 text-xs font-semibold text-[#1c1d1a] placeholder:text-[#1c1d1a]/30 focus:border-[#3d654c] focus:outline-none dark:border-neutral-800 dark:bg-[#181818] dark:text-white dark:placeholder:text-neutral-600 dark:focus:border-[#f2c14e] transition-colors"
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <label htmlFor="edit-username" className="text-xs font-bold text-[#1c1d1a] dark:text-white flex items-center gap-1.5">
              <AtSign size={13} className="text-[#3d654c] dark:text-[#f2c14e]" /> Citizen Username
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-xs font-bold text-[#1c1d1a]/40 dark:text-neutral-500 select-none">
                @
              </span>
              <input
                id="edit-username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.replace(/^@+/, ""));
                  setUsernameError("");
                }}
                placeholder="username"
                className="w-full rounded-xl border border-[#1c1d1a]/15 bg-[#f7f7f2] pl-8 pr-3.5 py-2.5 text-xs font-semibold text-[#1c1d1a] placeholder:text-[#1c1d1a]/30 focus:border-[#3d654c] focus:outline-none dark:border-neutral-800 dark:bg-[#181818] dark:text-white dark:placeholder:text-neutral-600 dark:focus:border-[#f2c14e] transition-colors"
                aria-invalid={Boolean(usernameError)}
              />
            </div>
            {usernameError && (
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle size={13} /> {usernameError}
              </p>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="edit-bio" className="text-xs font-bold text-[#1c1d1a] dark:text-white flex items-center gap-1.5">
                <FileText size={13} className="text-[#3d654c] dark:text-[#f2c14e]" /> Civic Bio
              </label>
              <span className="text-[10px] font-bold text-[#1c1d1a]/40 dark:text-neutral-500">
                {bio.length}/160
              </span>
            </div>
            <textarea
              id="edit-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share your local ward role, community interests, or reporting focus..."
              rows={3}
              maxLength={160}
              className="w-full rounded-xl border border-[#1c1d1a]/15 bg-[#f7f7f2] p-3 text-xs font-medium leading-relaxed text-[#1c1d1a] placeholder:text-[#1c1d1a]/30 focus:border-[#3d654c] focus:outline-none dark:border-neutral-800 dark:bg-[#181818] dark:text-white dark:placeholder:text-neutral-600 dark:focus:border-[#f2c14e] transition-colors resize-none"
            />
          </div>
        </div>

        {/* Verification Status Card */}
        <div className="flex items-center justify-between rounded-2xl border border-[#1c1d1a]/10 bg-white p-4 shadow-2xs dark:border-neutral-800/90 dark:bg-[#121212]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3d654c]/10 text-[#3d654c] dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">Citizen Verification</p>
              <p className="text-[10px] text-[#1c1d1a]/50 dark:text-neutral-400">Active Civic Triage Contributor</p>
            </div>
          </div>
          <span className="rounded-full bg-[#3d654c]/10 px-2.5 py-1 text-[10px] font-bold text-[#3d654c] dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
            Verified
          </span>
        </div>
      </div>
    </div>
  );
}
