import { useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { useAuth } from "../../context/AuthContext";
import { ProfileImagePicker } from "@/components/profile/ProfileImagePicker";

export default function CompleteProfile() {
  const { user, refreshProfileStatus } = useAuth();

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [imageError, setImageError] = useState("");

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

  async function saveProfile() {
    if (!user) return;

    setUsernameError("");
    setImageError("");

    const rawUsername = username.trim();
    const cleanUsername = rawUsername.replace(/^@+/, "").toLowerCase();

    if (cleanUsername.length < 3) {
      setUsernameError("Username must be at least 3 characters.");
      return;
    }

    setLoading(true);

    const usernameDoc = await getDoc(doc(db, "usernames", cleanUsername));

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
          photoURL: photoURL || "",
          profileCompleted: true,
        },
        { merge: true }
      );

      await setDoc(doc(db, "usernames", cleanUsername), {
        uid: user.uid,
      });

      await refreshProfileStatus();
    } catch (err: any) {
      setUsernameError(err.message || "Failed to save profile.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hivez-profile-shell">
      <div className="hivez-profile-card">
        <div className="hivez-profile-brand">
          <span className="hivez-brand-mark">H</span>
          Hivez
        </div>

        <header className="hivez-profile-header">
          <p className="hivez-kicker">Welcome</p>
          <h1>Complete your profile</h1>
          <p>Set up the face, name, and personality people will see in your Hivez space.</p>
        </header>

        <main className="hivez-profile-content-grid">
          <section className="hivez-profile-preview-column" aria-label="Profile photo selection">
            <ProfileImagePicker
              value={photoURL}
              onChange={setPhotoURL}
              onFileSelected={uploadProfileImage}
              onFileError={setImageError}
              onRemove={() => setPhotoURL("")}
              uploading={uploading}
            />
          </section>

          <section className="hivez-profile-form-column" aria-label="Profile information form">
            <div className="hivez-field-group">
              <label htmlFor="complete-username" className="hivez-field-label">
                Username
              </label>
              <div className="hivez-username-wrap">
                <span className="hivez-username-prefix">@</span>
                <input
                  id="complete-username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setUsernameError("");
                  }}
                  className="hivez-form-input hivez-username-input"
                  placeholder="yourname"
                  autoComplete="off"
                  aria-invalid={Boolean(usernameError)}
                />
              </div>
              <p className="hivez-field-help">This is how people will find and mention you.</p>
              {usernameError && <p className="hivez-field-error">{usernameError}</p>}
            </div>

            <div className="hivez-field-group">
              <label htmlFor="complete-bio" className="hivez-field-label">
                Bio
              </label>
              <textarea
                id="complete-bio"
                className="hivez-form-textarea"
                placeholder="Tell the community a little about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={5}
              />
            </div>

            {imageError && <div className="hivez-alert hivez-alert-error">{imageError}</div>}

            <button
              type="button"
              onClick={saveProfile}
              disabled={loading || uploading}
              className="hivez-submit-button"
            >
              {loading ? "Saving..." : "Continue"}
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}
