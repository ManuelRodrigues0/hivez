// HIVEZ — SIGNUP · canonical page layer (ONE FILE, MANY COMPONENTS)
// Routes preserved:
//   /signup            → Signup
//   /complete-profile  → CompleteProfile (post-signup profile completion)
// Consolidated verbatim from 2 former page files. Firebase Auth flow,
// validation, navigation and styling unchanged — structural merge only.
// Auth.css remains a SHARED page-layer stylesheet (Login + Signup both
// import ../Auth/Auth.css) — intentionally NOT merged.

// ============================================================
// IMPORTS
// ============================================================

import "../Auth/Auth.css";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthBackdrop } from "@/components/hivez/AuthBackdrop.tsx";
import { AuthField } from "@/components/hivez/AuthField.tsx";
import { BeeMascot, type BeeMood } from "@/components/hivez/BeeMascot.tsx";
import { ProfileImagePicker } from "@/components/profile/ProfileImagePicker.tsx";
import { useAuth } from "@/context/AuthContext.tsx";
import { db } from "@/firebase/firebase.ts";
import { GoogleIcon } from "@/pages/Login/Login.tsx";
import { googleLogin, signup } from "@/services/auth.ts";

// ============================================================
// SIGNUP   (consolidated from Signup.tsx)
// ============================================================

type Field = "name" | "email" | "password" | "confirm" | null;
type Status = "idle" | "loading" | "success" | "error";

function getAuthMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace("Firebase: ", "").replace(/\s*\(auth\/.*\)\.?$/, ".");
  }

  return "Something went wrong. Please try again.";
}

function Signup() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [active, setActive] = useState<Field>(null);
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [jump, setJump] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  function markTyping() {
    setTyping(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setTyping(false), 900);
  }

  const mismatch = confirm.length > 0 && confirm !== password;
  const matched = confirm.length > 0 && confirm === password;

  const mood: BeeMood =
    status === "success"
      ? "happy"
      : status === "error"
        ? "sad"
        : active === "password" && (typing || active === "password")
          ? "shy"
          : mismatch
            ? "confused"
            : matched
              ? "excited"
              : active === "name"
                ? "wave"
                : "idle";

  async function fireConfetti() {
    if (reduce) return;
    try {
      const confetti = (await import("canvas-confetti")).default;
      confetti({
        particleCount: 100,
        spread: 85,
        origin: { y: 0.6 },
        colors: ["#0EA5E9", "#14B8A6", "#F2C14E", "#ffffff"],
      });
    } catch {
      // Confetti is decorative; account creation should continue if unavailable.
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setJump((j) => j + 1);

    if (!name.trim() || !/\S+@\S+\.\S+/.test(email) || password.length < 6 || mismatch) {
      setStatus("error");
      setError(
        mismatch
          ? "Those two passwords don't match yet."
          : password.length < 6
            ? "Give your password at least 6 characters."
            : "Please fill in your name and a valid email.",
      );
      window.setTimeout(() => setStatus("idle"), 2600);
      return;
    }

    try {
      setStatus("loading");
      await signup(email.trim(), password);
      setStatus("success");
      await fireConfetti();
      navigate(from, { replace: true });
    } catch (err) {
      setStatus("error");
      setError(getAuthMessage(err));
      window.setTimeout(() => setStatus("idle"), 2600);
    }
  }

  async function handleGoogleSignup() {
    setError("");
    setJump((j) => j + 1);

    try {
      setStatus("loading");
      await googleLogin();
      setStatus("success");
      await fireConfetti();
      navigate(from, { replace: true });
    } catch (err) {
      setStatus("error");
      setError(getAuthMessage(err));
      window.setTimeout(() => setStatus("idle"), 2600);
    }
  }

  const busy = status === "loading";

  return (
    <AuthBackdrop>
      <main className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <section className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <span className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Join your local network
          </span>
          <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            Start reporting what your{" "}
            <span className="text-primary">community needs</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Create an account to post civic issues, support nearby reports, join conversations and
            help important local problems get seen.
          </p>

          <div className="mt-8 flex min-h-[220px] w-full items-center justify-center lg:justify-start">
            <BeeMascot mood={mood} jump={jump} size={380} />
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="glass-card rounded-[24px] p-6 sm:p-8"
          aria-labelledby="signup-title"
        >
          <h2 id="signup-title" className="text-2xl font-extrabold tracking-tight">
            Create your account
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">It takes less than a minute.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <AuthField
              label="Full name"
              autoComplete="name"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setActive("name")}
              onBlur={() => setActive(null)}
            />
            <AuthField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setActive("email")}
              onBlur={() => setActive(null)}
            />
            <AuthField
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              required
              minLength={6}
              onChange={(e) => {
                setPassword(e.target.value);
                markTyping();
              }}
              onFocus={() => setActive("password")}
              onBlur={() => setActive(null)}
            />
            <AuthField
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              invalid={mismatch}
              required
              minLength={6}
              onChange={(e) => {
                setConfirm(e.target.value);
                markTyping();
              }}
              onFocus={() => setActive("confirm")}
              onBlur={() => setActive(null)}
            />

            <AnimatePresence>
              {matched && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-sm font-semibold text-primary"
                >
                  Passwords match - nice one!
                </motion.p>
              )}
              {error && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, x: 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 18 }}
                  className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={busy}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="w-full rounded-2xl bg-primary px-5 py-3.5 text-base font-extrabold text-primary-foreground disabled:opacity-80"
            >
              {status === "loading"
                ? "Building your hive..."
                : status === "success"
                  ? "Welcome to Hivez!"
                  : "Create account"}
            </motion.button>

            <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <motion.button
              type="button"
              disabled={busy}
              onClick={handleGoogleSignup}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-bold disabled:opacity-80"
            >
              <GoogleIcon />
              Continue with Google
            </motion.button>

            <p className="pt-1 text-center text-sm text-muted-foreground">
              Already on Hivez?{" "}
              <Link to="/login" className="link-underline font-bold text-primary">
                Log in
              </Link>
            </p>
          </form>
        </motion.section>
      </main>
    </AuthBackdrop>
  );
}

// ============================================================
// COMPLETE PROFILE   (consolidated from CompleteProfile.tsx)
// ============================================================

function CompleteProfile() {
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
          usernameLower: cleanUsername,
          displayNameLower: (user.displayName || "").toLowerCase(),
          bio,
          photoURL: photoURL || "",
          privacy: {
            account: "public",
            messages: "everyone",
            mentions: "everyone",
            comments: "everyone",
            discoverable: true,
          },
          accountPrivacy: "public",
          isPrivate: false,
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

// ============================================================
// EXPORTS
// ============================================================

export { Signup as SignupPage, CompleteProfile as CompleteProfilePage };
export default Signup;
