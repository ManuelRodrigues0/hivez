import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";
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
          bio: bio.trim(),
          photoURL,
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
    return <HivezLoader fullScreen size="lg" progress={58} label="Loading profile editor" />;
  }

  return (
    <div className="hivez-profile-shell">
      <div className="hivez-profile-card hivez-edit-profile-card">
        <header className="hivez-profile-header hivez-edit-header">
          <div className="hivez-edit-header-row">
            <button type="button" onClick={() => navigate(-1)} className="hivez-icon-button" aria-label="Go back">
              <ArrowLeft size={18} />
            </button>
            <div>
              <p className="hivez-kicker">Profile</p>
              <h1>Edit profile</h1>
            </div>
            <button type="button" onClick={save} disabled={saving || uploading} className="hivez-submit-button hivez-submit-button-inline">
              <Save size={16} />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </header>

        <main className="hivez-profile-content-grid hivez-edit-content-grid">
          <section className="hivez-profile-preview-column" aria-label="Profile photo editor">
            <ProfileImagePicker
              value={photoURL}
              onChange={setPhotoURL}
              onFileSelected={uploadProfileImage}
              onFileError={setImageError}
              onRemove={() => setPhotoURL("")}
              uploading={uploading}
            />
          </section>

          <section className="hivez-profile-form-column" aria-label="Edit profile fields">
            <div className="hivez-field-group">
              <label htmlFor="edit-display-name" className="hivez-field-label">
                Display name
              </label>
              <input
                id="edit-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                className="hivez-form-input"
              />
            </div>

            <div className="hivez-field-group">
              <label htmlFor="edit-username" className="hivez-field-label">
                Username
              </label>
              <div className="hivez-username-wrap">
                <span className="hivez-username-prefix">@</span>
                <input
                  id="edit-username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value.replace(/^@+/, ""));
                    setUsernameError("");
                  }}
                  placeholder="username"
                  className="hivez-form-input hivez-username-input"
                  aria-invalid={Boolean(usernameError)}
                />
              </div>
              <p className="hivez-field-help">This is how people will find and mention you.</p>
              {usernameError && <p className="hivez-field-error">{usernameError}</p>}
            </div>

            <div className="hivez-field-group">
              <label htmlFor="edit-bio" className="hivez-field-label">
                Bio
              </label>
              <textarea
                id="edit-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people a little about yourself."
                rows={5}
                className="hivez-form-textarea"
              />
              <p className="hivez-field-meta">{bio.length}/160</p>
            </div>

            {imageError && <div className="hivez-alert hivez-alert-error">{imageError}</div>}
          </section>
        </main>
      </div>
    </div>
  );
}
