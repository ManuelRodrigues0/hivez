import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AuthBackdrop } from "@/components/hivez/AuthBackdrop";
import { AuthField } from "@/components/hivez/AuthField";
import { BeeMascot, type BeeMood } from "@/components/hivez/BeeMascot";
import { googleLogin, login } from "../../services/auth";
import "../Auth/Auth.css";

type Slot = "hero" | "button" | "password";
type Status = "idle" | "loading" | "success" | "error";

function getAuthMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.replace("Firebase: ", "").replace(/\s*\(auth\/.*\)\.?$/, ".");
  }

  return "Something went wrong. Please try again.";
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.2s2.7-6.2 6-6.2c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 2.9 14.7 2 12 2 6.9 2 2.8 6.1 2.8 12S6.9 22 12 22c5.8 0 9.6-4 9.6-9.7 0-.7-.1-1.2-.2-1.8H12z"
      />
    </svg>
  );
}

export default function Login() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [focusField, setFocusField] = useState<"email" | "password" | null>(null);
  const [hoverLogin, setHoverLogin] = useState(false);
  const [typing, setTyping] = useState(false);
  const [jump, setJump] = useState(0);
  const [flying, setFlying] = useState(false);
  const typingTimer = useRef<number | null>(null);
  const flyTimer = useRef<number | null>(null);

  const slot: Slot =
    focusField === "password"
      ? "password"
      : focusField === "email" || hoverLogin || status !== "idle"
        ? "button"
        : "hero";
  const prevSlot = useRef<Slot>(slot);

  useEffect(
    () => () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      if (flyTimer.current) window.clearTimeout(flyTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (prevSlot.current === slot) return;
    prevSlot.current = slot;
    setFlying(true);
    if (flyTimer.current) window.clearTimeout(flyTimer.current);
    flyTimer.current = window.setTimeout(() => setFlying(false), 1100);
  }, [slot]);

  const mood: BeeMood =
    status === "success"
      ? "happy"
      : status === "error"
        ? "sad"
        : slot === "password" && (typing || focusField === "password")
          ? "shy"
          : flying
            ? "fly"
            : hoverLogin
              ? "excited"
              : "idle";
  const mobileMood: BeeMood =
    status === "success"
      ? "happy"
      : status === "error"
        ? "sad"
        : focusField === "password" && (typing || focusField === "password")
          ? "shy"
          : focusField === "email" || status !== "idle"
            ? "excited"
            : "idle";

  function markTyping() {
    setTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setTyping(false), 900);
  }

  async function fireConfetti() {
    if (reduce) return;
    try {
      const confetti = (await import("canvas-confetti")).default;
      const colors = ["#0EA5E9", "#14B8A6", "#F2C14E", "#ffffff"];
      confetti({ particleCount: 90, spread: 78, origin: { y: 0.6 }, colors });
      window.setTimeout(() => confetti({ particleCount: 60, spread: 110, origin: { y: 0.5 }, colors }), 280);
    } catch {
      // Confetti is decorative; auth should continue if the optional module is unavailable.
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setJump((j) => j + 1);
    setStatus("loading");

    try {
      await login(email.trim(), password);
      setStatus("success");
      await fireConfetti();
      navigate(from, { replace: true });
    } catch (err) {
      setStatus("error");
      setError(getAuthMessage(err));
      window.setTimeout(() => setStatus("idle"), 2600);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setJump((j) => j + 1);
    setStatus("loading");

    try {
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
  const bee = (
    <motion.div layoutId="hivez-bee" layout transition={{ type: "spring", stiffness: 160, damping: 20 }}>
      <BeeMascot mood={mood} jump={jump} size={slot === "hero" ? 380 : 132} />
    </motion.div>
  );

  return (
    <AuthBackdrop>
      <main className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <section className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <span className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Local action starts here
          </span>
          <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            Welcome back to{" "}
            <span className="text-primary">Hivez</span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Sign in to report issues, follow nearby updates, support important posts and stay
            connected with what is happening around you.
          </p>

          <div className="auth-mobile-bee-home mt-8 flex min-h-[220px] w-full items-center justify-center lg:hidden">
            <BeeMascot mood={mobileMood} jump={jump} size={760} />
          </div>

          <div className="auth-desktop-bee-home mt-8 hidden min-h-[220px] w-full items-center justify-center lg:flex lg:justify-start">
            <AnimatePresence>{slot === "hero" && bee}</AnimatePresence>
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="glass-card relative rounded-[24px] p-6 sm:p-8"
          aria-labelledby="login-title"
        >
          <h2 id="login-title" className="text-2xl font-extrabold tracking-tight">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Log in to your hive.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <AuthField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusField("email")}
              onBlur={() => setFocusField(null)}
            />

            <div className="relative">
              <AuthField
                label="Password"
                type="password"
                autoComplete="current-password"
                value={password}
                invalid={status === "error"}
                required
                onChange={(e) => {
                  setPassword(e.target.value);
                  markTyping();
                }}
                onFocus={() => setFocusField("password")}
                onBlur={() => setFocusField(null)}
              />
              <div className="pointer-events-auto absolute -top-32 -right-6 hidden lg:block">
                <AnimatePresence>{slot === "password" && bee}</AnimatePresence>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2.5 text-muted-foreground">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={remember}
                  aria-label="Remember me"
                  onClick={() => setRemember((v) => !v)}
                  className="grid h-5 w-5 place-items-center rounded-md border border-border bg-card transition-colors"
                >
                  <motion.span
                    animate={{ scale: remember ? 1 : 0, opacity: remember ? 1 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 14 }}
                    className="block h-2.5 w-2.5 rounded-[3px] bg-primary"
                  />
                </button>
                Remember me
              </label>
              <a href="#reset" className="link-underline text-primary">
                Forgot password?
              </a>
            </div>

            <AnimatePresence>
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

            <div className="auth-login-submit relative pt-28 max-lg:pt-0">
              <div className="pointer-events-auto absolute top-1 left-1/2 -translate-x-1/2 hidden lg:block">
                <AnimatePresence>{slot === "button" && bee}</AnimatePresence>
              </div>
              <motion.button
                type="submit"
                disabled={busy}
                onHoverStart={() => setHoverLogin(true)}
                onHoverEnd={() => setHoverLogin(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="w-full rounded-2xl bg-primary px-5 py-3.5 text-base font-extrabold text-primary-foreground disabled:opacity-80"
              >
                {status === "loading" ? "Buzzing you in..." : status === "success" ? "You're in!" : "Log in"}
              </motion.button>
            </div>

            <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <motion.button
              type="button"
              disabled={busy}
              onClick={handleGoogleLogin}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-bold disabled:opacity-80"
            >
              <GoogleIcon />
              Continue with Google
            </motion.button>

            <p className="pt-1 text-center text-sm text-muted-foreground">
              New to Hivez?{" "}
              <Link to="/signup" className="link-underline font-bold text-primary">
                Create an account
              </Link>
            </p>
          </form>
        </motion.section>
      </main>
    </AuthBackdrop>
  );
}
