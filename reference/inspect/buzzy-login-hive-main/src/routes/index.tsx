import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AuthBackdrop } from "@/components/hivez/AuthBackdrop";
import { AuthField } from "@/components/hivez/AuthField";
import { BeeMascot, type BeeMood } from "@/components/hivez/BeeMascot";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in to Hivez — your local community feed" },
      {
        name: "description",
        content:
          "Log in to Hivez to report neighborhood issues, upvote nearby reports and follow what is happening around you.",
      },
      { property: "og:title", content: "Sign in to Hivez" },
      {
        property: "og:description",
        content: "Log in to Hivez to report local issues and follow your community feed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

type Slot = "hero" | "button" | "password";

function LoginPage() {
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [focusField, setFocusField] = useState<"email" | "password" | null>(null);
  const [hoverLogin, setHoverLogin] = useState(false);
  const [typing, setTyping] = useState(false);
  const [jump, setJump] = useState(0);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
  }, []);

  const slot: Slot =
    focusField === "password"
      ? "password"
      : focusField === "email" || hoverLogin || status !== "idle"
        ? "button"
        : "hero";

  const [flying, setFlying] = useState(false);
  const prevSlot = useRef<Slot>(slot);
  const flyTimer = useRef<number | null>(null);

  useEffect(() => {
    if (prevSlot.current === slot) return;
    prevSlot.current = slot;
    setFlying(true);
    if (flyTimer.current) window.clearTimeout(flyTimer.current);
    flyTimer.current = window.setTimeout(() => setFlying(false), 1100);
    return () => {
      if (flyTimer.current) window.clearTimeout(flyTimer.current);
    };
  }, [slot]);

  const mood: BeeMood =
    status === "success"
      ? "happy"
      : status === "error"
        ? "sad"
        : slot === "password" && typing
          ? "shy"
          : flying
            ? "fly"
            : hoverLogin
              ? "excited"
              : "idle";

  function markTyping() {
    setTyping(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setTyping(false), 900);
  }

  async function fireConfetti() {
    if (reduce) return;
    const confetti = (await import("canvas-confetti")).default;
    const colors = ["#0EA5E9", "#14B8A6", "#F2C14E", "#ffffff"];
    confetti({ particleCount: 90, spread: 78, origin: { y: 0.6 }, colors });
    window.setTimeout(
      () => confetti({ particleCount: 60, spread: 110, origin: { y: 0.5 }, colors }),
      280,
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setJump((j) => j + 1);
    setStatus("loading");

    window.setTimeout(() => {
      const ok = /\S+@\S+\.\S+/.test(email) && password.length >= 6;
      if (ok) {
        setStatus("success");
        void fireConfetti();
      } else {
        setStatus("error");
        setError(
          !/\S+@\S+\.\S+/.test(email)
            ? "That email doesn't look quite right yet."
            : "Passwords need at least 6 characters. You've got this!",
        );
        window.setTimeout(() => setStatus("idle"), 2600);
      }
    }, 900);
  }

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
            Welcome back to
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              {" "}
              Hivez
            </span>
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Sign in to report issues, follow nearby updates, support important posts and stay
            connected with what is happening around you.
          </p>

          <div className="mt-8 flex min-h-[220px] w-full items-center justify-center lg:justify-start">
            <AnimatePresence>{slot === "hero" && bee}</AnimatePresence>
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="glass-card relative rounded-[24px] p-6 sm:p-8"
        >
          <h2 className="text-2xl font-extrabold tracking-tight">Welcome back</h2>
          <p className="mt-1 text-sm text-muted-foreground">Log in to your hive.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <AuthField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  markTyping();
                }}
                onFocus={() => setFocusField("password")}
                onBlur={() => setFocusField(null)}
              />
              <div className="pointer-events-none absolute -top-32 -right-6 hidden lg:block">
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
                  className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="relative pt-28">
              <div className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2">
                <AnimatePresence>{slot === "button" && bee}</AnimatePresence>
              </div>
              <motion.button
                type="submit"
                disabled={status === "loading"}
                onHoverStart={() => setHoverLogin(true)}
                onHoverEnd={() => setHoverLogin(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="w-full rounded-2xl bg-gradient-to-r from-primary to-secondary px-5 py-3.5 text-base font-extrabold text-primary-foreground shadow-[0_14px_35px_-12px_var(--primary)] disabled:opacity-80"
              >
                {status === "loading" ? "Buzzing you in…" : status === "success" ? "You're in! 🎉" : "Log in"}
              </motion.button>
            </div>

            <div className="flex items-center gap-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-border bg-card px-5 py-3 text-sm font-bold"
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
