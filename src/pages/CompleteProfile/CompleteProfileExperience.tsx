import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { AuthBackdrop } from "@/components/hivez/AuthBackdrop";
import { AuthCompanion } from "@/components/hivez/AuthCompanion";
import type { BeeMood } from "@/components/hivez/BeeMascot";
import { ProfileImagePicker } from "@/components/profile/ProfileImagePicker";
import type { ProfileDraft } from "@/services/completeProfile";
import "@/pages/Auth/Auth.css";
import "./CompleteProfile.css";

type Props = {
  displayName: string;
  onUpload: (file: File) => Promise<string>;
  onComplete: (draft: ProfileDraft) => Promise<void>;
};

export default function CompleteProfileExperience({
  displayName,
  onUpload,
  onComplete,
}: Props) {
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [mood, setMood] = useState<BeeMood>("fly");
  const inputRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const pending = useRef(false);
  const cleanUsername = username.trim().replace(/^@+/, "").toLowerCase();
  const busy = uploading || saving;
  const hasUsername = cleanUsername.length >= 3;
  const usernameError = error.startsWith("Username") || error.includes("already taken");
  const detailsCount =
    Number(hasUsername) +
    Number(Boolean(photoURL)) +
    Number(Boolean(bio.trim()));

  useEffect(() => {
    alive.current = true;
    const title = document.title;
    document.title = "Make it yours — Hivez";
    return () => {
      alive.current = false;
      document.title = title;
    };
  }, []);

  useEffect(() => {
    // Wait until the pending form is enabled before returning focus to a handle
    // rejected by the availability lookup.
    if (usernameError && !saving) inputRef.current?.focus();
  }, [usernameError, saving]);

  async function upload(file: File) {
    setUploading(true);
    setImageError("");
    try {
      const url = await onUpload(file);
      if (alive.current) {
        setPhotoURL(url);
        setMood("wave");
      }
    } catch {
      if (alive.current)
        setImageError("Profile photo upload failed. Please try again.");
    } finally {
      if (alive.current) setUploading(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || busy) return;
    setError("");
    if (!hasUsername) {
      setError("Username must be at least 3 characters.");
      inputRef.current?.focus();
      return;
    }
    pending.current = true;
    setSaving(true);
    setMood("idle");
    try {
      await onComplete({ username: cleanUsername, bio, photoURL });
    } catch (failure) {
      if (alive.current) {
        const taken =
          (failure as { code?: string })?.code === "profile/username-taken";
        setError(
          taken
            ? "That username is already taken. Try another."
            : "We couldn’t save your profile. Your details are still here — please try again.",
        );
        if (taken) inputRef.current?.focus();
      }
    } finally {
      pending.current = false;
      if (alive.current) setSaving(false);
    }
  }

  return (
    <AuthBackdrop mode="complete">
      <main className="cp-main">
        <aside className="cp-portrait" aria-label="Your profile preview">
          <img
            className="cp-community-photo"
            src="/auth/people-together.jpg"
            alt="Volunteers working together in a shared outdoor space"
            width="1800"
            height="1200"
          />
          <div className="cp-portrait-shade" />
          <div className="cp-portrait-content">
            <p className="cp-intro-label">A place for your kind of change.</p>
            <h2>
              Your hive.{" "}
              <br />
              With a little more <em>you.</em>
            </h2>
            <div className="cp-profile-preview">
              <div className="cp-preview-top">
                <span>YOUR PROFILE PREVIEW</span>
                <span className="cp-live-dot">Updates as you type</span>
              </div>
              <ProfileImagePicker
                variant="onboarding"
                initial={(
                  cleanUsername[0] ||
                  displayName[0] ||
                  "?"
                ).toUpperCase()}
                value={photoURL}
                onChange={(value) => {
                  setPhotoURL(value);
                  setImageError("");
                  setMood("wave");
                }}
                onFileSelected={upload}
                onFileError={setImageError}
                onRemove={() => {
                  setPhotoURL("");
                  setImageError("");
                }}
                uploading={uploading}
                disabled={saving}
              />
              <div className="cp-preview-identity">
                {displayName && (
                  <p className="cp-preview-name">{displayName}</p>
                )}
                <h3 className={!cleanUsername ? "is-placeholder" : ""}>
                  @{cleanUsername || "yourname"}
                </h3>
                <p
                  className={`cp-preview-bio ${!bio.trim() ? "is-placeholder" : ""}`}
                >
                  {bio ||
                    "A little about you. What you care about. What brings you here."}
                </p>
              </div>
              <div className="cp-preview-bottom">
                <span>
                  {hasUsername
                    ? "A name for your neighbourhood."
                    : "Every connection starts with a hello."}
                </span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </div>
            </div>
            <p className="cp-photo-help">
              Upload a photo, take one, or choose an avatar. Make yourself
              recognisable.
            </p>
            {uploading && (
              <p className="cp-upload-status" role="status">
                <LoaderCircle
                  size={15}
                  className="ha-spinner"
                  aria-hidden="true"
                />{" "}
                Uploading your photo…
              </p>
            )}
            {imageError && (
              <p className="cp-image-error" role="alert">
                {imageError}
              </p>
            )}
          </div>
        </aside>
        <section className="cp-details" aria-labelledby="cp-title">
          <div className="cp-arrival">
            <Check size={16} aria-hidden="true" />
            <span>Your account is ready.</span>
            <span>One last hello.</span>
          </div>
          <AuthCompanion
            mood={mood}
            onGreet={() => setMood("wave")}
            onEnd={() => setMood("idle")}
          />
          <header className="cp-heading">
            <h1 id="cp-title">Make it yours.</h1>
            <p>
              Give your neighbours a name to remember
              <br className="cp-desktop-break" /> and a little sense of who you
              are.
            </p>
          </header>
          <form
            id="cp-form"
            onSubmit={submit}
            noValidate
            tabIndex={-1}
            aria-busy={busy}
          >
            <div className="ha-field">
              <label htmlFor="cp-username">
                Choose your username{" "}
                <span className="cp-required">Required</span>
              </label>
              <div className="ha-input-wrap cp-username-wrap">
                <span aria-hidden="true">@</span>
                <input
                  ref={inputRef}
                  id="cp-username"
                  value={username}
                  required
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="yourname"
                  disabled={busy}
                  aria-invalid={usernameError}
                  aria-describedby="cp-username-help cp-error"
                  onFocus={() => setMood("wave")}
                  onBlur={() => setMood("idle")}
                  onChange={(event) => {
                    setUsername(event.target.value);
                    setError("");
                  }}
                />
              </div>
              <p className="cp-help" id="cp-username-help">
                At least 3 characters. We’ll check availability when you
                continue.
              </p>
            </div>
            <div className="ha-field">
              <label htmlFor="cp-bio">
                A little about you <span className="cp-optional">Optional</span>
              </label>
              <textarea
                id="cp-bio"
                value={bio}
                placeholder="What matters to you around here?"
                rows={4}
                disabled={busy}
                aria-describedby="cp-bio-help"
                onChange={(event) => setBio(event.target.value)}
              />
              <p className="cp-help" id="cp-bio-help">
                A cause you care about. A skill you can share. Or simply a
                hello.
              </p>
            </div>
            <div
              className="cp-progress"
              role="group"
              aria-label={`${detailsCount} of 3 profile details added`}
            >
              <span>
                {[hasUsername, Boolean(photoURL), Boolean(bio.trim())].map(
                  (done, i) => (
                    <i key={i} data-complete={done} />
                  ),
                )}
              </span>
              <p>
                {detailsCount === 3
                  ? "Looking like you."
                  : "A username is all you need to begin."}
              </p>
            </div>
            <p
              id="cp-error"
              className={error ? "ha-error" : "cp-empty-error"}
              role={error ? "alert" : undefined}
            >
              {error}
            </p>
            <button type="submit" className="ha-primary" disabled={busy}>
              <span>
                {saving
                  ? "Getting your hive ready…"
                  : uploading
                    ? "Uploading your photo…"
                    : "Enter my hive"}
              </span>
              {busy ? (
                <LoaderCircle
                  size={19}
                  className="ha-spinner"
                  aria-hidden="true"
                />
              ) : (
                <ArrowUpRight size={20} aria-hidden="true" />
              )}
            </button>
            <p className="cp-privacy-note">
              <ShieldCheck size={16} aria-hidden="true" /> Your profile starts
              public. You can change this in Settings.
            </p>
          </form>
        </section>
      </main>
    </AuthBackdrop>
  );
}
