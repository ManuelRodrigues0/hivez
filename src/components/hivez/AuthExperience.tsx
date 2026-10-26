import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, LoaderCircle, Mail } from "lucide-react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/firebase/firebase";
import { googleLogin, login, signup } from "@/services/auth";
import { AuthBackdrop } from "./AuthBackdrop";
import { AuthField } from "./AuthField";
import type { BeeMood } from "./BeeMascot";
import { AuthWelcome } from "./AuthWelcome";
import { AuthCompanion } from "./AuthCompanion";
import "@/pages/Auth/Auth.css";

type Field = "name" | "email" | "password" | "confirm";
type Values = Record<Field, string>;
type Mode = "login" | "signup";
const emptyValues: Values = { name: "", email: "", password: "", confirm: "" };

function authMessage(error: unknown) {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password didn’t match. Check your details and try again.";
    case "auth/email-already-in-use":
      return "An account already uses this email. Try logging in or resetting your password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a little before trying again.";
    case "auth/network-request-failed":
      return "We couldn’t connect. Check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was closed. You can try again whenever you’re ready.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google window. Allow pop-ups for Hivez and try again.";
    case "auth/user-disabled":
      return "This account is unavailable. Please contact Hivez support.";
    case "auth/weak-password":
      return "Choose a password with at least 6 characters.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    default:
      return "We couldn’t complete that request. Please try again.";
  }
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.6h3.3c1.9-1.8 2.9-4.3 2.9-7.5Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.7-2.5l-3.3-2.6c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.7A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.7a6 6 0 0 1 0-3.4V7.6H3a10 10 0 0 0 0 8.8l3.4-2.7Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2a10 10 0 0 0-9 5.6l3.4 2.7A6 6 0 0 1 12 6.1Z"
      />
    </svg>
  );
}

function PasswordGuide({ value }: { value: string }) {
  const score = !value
    ? 0
    : value.length < 6
      ? 1
      : value.length < 10
        ? 2
        : value.length < 12
          ? 3
          : 4;
  return (
    <div className="ha-password-guide" id="ha-password-guide">
      <span className="ha-strength-bars" aria-hidden="true">
        {[1, 2, 3, 4].map((n) => (
          <i key={n} data-filled={score >= n} />
        ))}
      </span>
      <span>
        {!value
          ? "6 characters minimum. Longer is better."
          : value.length < 6
            ? "Keep going — at least 6 characters."
            : value.length < 12
              ? "Minimum met. Try 12+ for more protection."
              : "Good length. Keep it unique to Hivez."}
      </span>
    </div>
  );
}

export default function AuthExperience({ mode }: { mode: Mode }) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const location = useLocation();
  const routeFrom = (location.state as { from?: string } | null)?.from;
  const from =
    typeof routeFrom === "string" &&
    routeFrom.startsWith("/") &&
    !routeFrom.startsWith("//")
      ? routeFrom
      : "/";
  const [values, setValues] = useState<Values>(emptyValues);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState<"email" | "google" | "reset" | null>(
    null,
  );
  const [error, setError] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [sent, setSent] = useState(false);
  const [step, setStep] = useState<0 | 1>(0);
  const [mood, setMood] = useState<BeeMood>("fly");
  const alive = useRef(true);
  const pendingRef = useRef(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousRecovery = useRef(recovery);
  const previousStep = useRef(step);
  const busy = pending !== null;
  const errors: Partial<Record<Field, string>> = {
    name: isSignup && !values.name.trim() ? "Tell us your name." : "",
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
      ? "Enter a valid email address."
      : "",
    password: !values.password
      ? "Enter your password."
      : isSignup && values.password.length < 6
        ? "Use at least 6 characters."
        : "",
    confirm:
      isSignup && !values.confirm
        ? "Confirm your password."
        : isSignup && values.confirm !== values.password
          ? "These passwords don’t match yet."
          : "",
  };
  useEffect(() => {
    alive.current = true;
    const oldTitle = document.title;
    document.title = `${isSignup ? "Join the hive" : "Welcome back"} — Hivez`;
    return () => {
      alive.current = false;
      document.title = oldTitle;
    };
  }, [isSignup]);
  useEffect(() => {
    if (previousRecovery.current !== recovery) titleRef.current?.focus();
    previousRecovery.current = recovery;
  }, [recovery]);
  useEffect(() => {
    if (previousStep.current !== step) titleRef.current?.focus();
    previousStep.current = step;
  }, [step]);

  const update = (field: Field, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setError("");
  };
  const blur = (field: Field) => {
    setTouched((v) => ({ ...v, [field]: true }));
    setMood(
      field === "confirm" && values.confirm && !errors.confirm
        ? "wave"
        : "idle",
    );
  };
  const fieldProps = (field: Field) => ({
    id: `ha-${field}`,
    value: values[field],
    disabled: busy,
    error: touched[field] || submitted ? errors[field] : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      update(field, e.target.value),
    onFocus: () =>
      setMood(field === "password" || field === "confirm" ? "shy" : "wave"),
    onBlur: () => blur(field),
  });
  function validate(fields: Field[]) {
    setSubmitted(true);
    const first = fields.find((field) => errors[field]);
    if (first) {
      document.getElementById(`ha-${first}`)?.focus();
      return false;
    }
    return true;
  }
  async function run(action: "email" | "google" | "reset") {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(action);
    setError("");
    setMood("idle");
    try {
      if (action === "reset") {
        await sendPasswordResetEmail(auth, values.email.trim());
        if (alive.current) {
          setSent(true);
          setMood("wave");
        }
      } else {
        if (action === "google") await googleLogin();
        else if (isSignup) await signup(values.email.trim(), values.password);
        else await login(values.email.trim(), values.password);
        if (alive.current) {
          setMood("happy");
          navigate(from, { replace: true });
        }
      }
    } catch (err) {
      if (alive.current) {
        setError(authMessage(err));
        setMood("idle");
      }
    } finally {
      pendingRef.current = false;
      if (alive.current) setPending(null);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (isSignup && !recovery && step === 0) {
      if (validate(["name", "email"])) {
        setStep(1);
        setSubmitted(false);
        setMood("wave");
      }
      return;
    }
    if (
      validate(
        recovery
          ? ["email"]
          : isSignup
            ? ["name", "email", "password", "confirm"]
            : ["email", "password"],
      )
    )
      void run(recovery ? "reset" : "email");
  }
  function switchRecovery(next: boolean) {
    setRecovery(next);
    setSubmitted(false);
    setTouched({});
    setError("");
    setSent(false);
    setMood("idle");
  }

  return (
    <AuthBackdrop mode={mode}>
      <main className="ha-main">
        <AuthWelcome />
        <section className="ha-form-section" aria-labelledby="ha-form-title">
          <nav className="ha-mode-nav" aria-label="Account access">
            <Link
              to="/login"
              state={{ from }}
              aria-current={!isSignup ? "page" : undefined}
            >
              Log in
            </Link>
            <Link
              to="/signup"
              state={{ from }}
              aria-current={isSignup ? "page" : undefined}
            >
              Sign up
            </Link>
          </nav>
          <AuthCompanion
            mood={mood}
            onGreet={() => setMood("wave")}
            onEnd={() =>
              setMood((current) => (current === "shy" ? current : "idle"))
            }
          />
          <div
            className="ha-form-content"
            key={recovery ? "reset" : `${mode}-${step}`}
          >
            <header className="ha-form-heading">
              {isSignup && !recovery && (
                <p className="ha-step-status">
                  Step {step + 1} of 2 <span aria-hidden="true">·</span>{" "}
                  {step === 0 ? "Your details" : "Your password"}
                </p>
              )}
              <h1 id="ha-form-title" ref={titleRef} tabIndex={-1}>
                {recovery
                  ? sent
                    ? "Check your inbox."
                    : "A fresh start."
                  : isSignup
                    ? step === 0
                      ? "Find your people."
                      : "Make it your hive."
                    : "Welcome back."}
              </h1>
              <p>
                {recovery
                  ? sent
                    ? "A little help getting back to your hive."
                    : "We’ll help you get back to your hive."
                  : isSignup
                    ? step === 0
                      ? "Create an account. Start something good."
                      : "Choose a password to keep your account safe."
                    : "Log in. See what’s happening around you."}
              </p>
            </header>
            {sent ? (
              <div className="ha-reset-sent" role="status">
                <Mail size={28} aria-hidden="true" />
                <p>
                  If an account exists for{" "}
                  <strong>{values.email.trim()}</strong>, you’ll receive a
                  password reset link. Check your spam folder too.
                </p>
                <button
                  type="button"
                  className="ha-primary"
                  onClick={() => switchRecovery(false)}
                >
                  Back to log in
                  <ArrowUpRight size={19} />
                </button>
              </div>
            ) : (
              <>
                {!recovery && (!isSignup || step === 0) && (
                  <>
                    <button
                      type="button"
                      className="ha-google"
                      disabled={busy}
                      onClick={() => void run("google")}
                    >
                      <GoogleIcon />
                      {pending === "google"
                        ? "Opening Google…"
                        : "Continue with Google"}
                      <ArrowUpRight size={17} aria-hidden="true" />
                    </button>
                    <div className="ha-divider">
                      <span />
                      or use your email
                      <span />
                    </div>
                  </>
                )}
                <form
                  id="ha-form"
                  onSubmit={submit}
                  noValidate
                  aria-busy={busy}
                  tabIndex={-1}
                >
                  {isSignup && step === 0 && !recovery && (
                    <AuthField
                      label="Full name"
                      type="text"
                      autoComplete="name"
                      placeholder="Your name"
                      required
                      {...fieldProps("name")}
                    />
                  )}
                  {(!isSignup || step === 0 || recovery) && (
                    <AuthField
                      label="Email address"
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="you@example.com"
                      required
                      {...fieldProps("email")}
                    />
                  )}
                  {isSignup && step === 1 && !recovery && (
                    <div className="ha-details-summary">
                      <span>{values.email.trim()}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setStep(0);
                          setSubmitted(false);
                          setError("");
                        }}
                      >
                        Edit details
                      </button>
                    </div>
                  )}
                  {!recovery && (!isSignup || step === 1) && (
                    <>
                      <AuthField
                        label="Password"
                        type="password"
                        autoComplete={
                          isSignup ? "new-password" : "current-password"
                        }
                        placeholder={
                          isSignup ? "Make it yours" : "Your password"
                        }
                        required
                        minLength={isSignup ? 6 : undefined}
                        {...fieldProps("password")}
                        onReveal={() => setMood("shy")}
                        aria-describedby={
                          isSignup ? "ha-password-guide" : undefined
                        }
                      />
                      {isSignup && <PasswordGuide value={values.password} />}
                      {isSignup && (
                        <AuthField
                          label="Confirm password"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Once more, just to be sure"
                          required
                          {...fieldProps("confirm")}
                          onReveal={() => setMood("shy")}
                          hint={
                            values.confirm && !errors.confirm
                              ? "Passwords match."
                              : undefined
                          }
                        />
                      )}
                      {!isSignup && (
                        <div className="ha-forgot">
                          <button
                            type="button"
                            onClick={() => switchRecovery(true)}
                            disabled={busy}
                          >
                            Forgot password?
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {recovery && (
                    <p className="ha-recovery-help">
                      Enter the email address you use for Hivez. We’ll send
                      instructions to reset your password.
                    </p>
                  )}
                  {error && (
                    <p className="ha-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button type="submit" className="ha-primary" disabled={busy}>
                    <span>
                      {busy
                        ? pending === "reset"
                          ? "Sending your link…"
                          : isSignup
                            ? "Creating your account…"
                            : "Logging you in…"
                        : recovery
                          ? "Send reset link"
                          : isSignup
                            ? step === 0
                              ? "Continue"
                              : "Create account"
                            : "Log in"}
                    </span>
                    {busy ? (
                      <LoaderCircle
                        className="ha-spinner"
                        size={19}
                        aria-hidden="true"
                      />
                    ) : (
                      <ArrowUpRight size={20} aria-hidden="true" />
                    )}
                  </button>
                  <p className="ha-form-footnote">
                    {recovery ? (
                      <button
                        className="ha-text-button"
                        type="button"
                        onClick={() => switchRecovery(false)}
                        disabled={busy}
                      >
                        <ArrowLeft size={14} aria-hidden="true" />
                        Back to log in
                      </button>
                    ) : isSignup ? (
                      <>
                        Already part of Hivez?{" "}
                        <Link to="/login" state={{ from }}>
                          Log in
                        </Link>
                      </>
                    ) : (
                      <>
                        New to Hivez?{" "}
                        <Link to="/signup" state={{ from }}>
                          Create an account{" "}
                          <ArrowUpRight size={13} aria-hidden="true" />
                        </Link>
                      </>
                    )}
                  </p>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
    </AuthBackdrop>
  );
}
