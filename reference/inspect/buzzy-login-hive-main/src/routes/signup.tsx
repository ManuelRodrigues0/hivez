import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { AuthBackdrop } from "@/components/hivez/AuthBackdrop";
import { AuthField } from "@/components/hivez/AuthField";
import { BeeMascot, type BeeMood } from "@/components/hivez/BeeMascot";
import { GoogleIcon } from "./index";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Join Hivez — start reporting what your area needs" },
      {
        name: "description",
        content:
          "Create your Hivez account to post civic issues, support nearby reports and help local problems get seen.",
      },
      { property: "og:title", content: "Join Hivez" },
      {
        property: "og:description",
        content: "Create a Hivez account and help your neighborhood get heard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

type Field = "name" | "email" | "password" | "confirm" | null;

function SignupPage() {
  const reduce = useReducedMotion();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [active, setActive] = useState<Field>(null);
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [jump, setJump] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

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
        : active === "password" && typing
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
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 100,
      spread: 85,
      origin: { y: 0.6 },
      colors: ["#0EA5E9", "#14B8A6", "#F2C14E", "#ffffff"],
    });
  }

  function handleSubmit(e: React.FormEvent) {
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

    setStatus("loading");
    window.setTimeout(() => {
      setStatus("success");
      void fireConfetti();
    }, 900);
  }

  return (
    <AuthBackdrop>
      <main className="mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <section className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <span className="rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Join your local network
          </span>
          <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl">
            Start reporting what your
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              {" "}
              community needs
            </span>
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
        >
          <h2 className="text-2xl font-extrabold tracking-tight">Create your account</h2>
          <p className="mt-1 text-sm text-muted-foreground">It takes less than a minute.</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <AuthField
              label="Full name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setActive("name")}
              onBlur={() => setActive(null)}
            />
            <AuthField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setActive("email")}
              onBlur={() => setActive(null)}
            />
            <AuthField
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
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
                  Passwords match — nice one! 👍
                </motion.p>
              )}
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

            <motion.button
              type="submit"
              disabled={status === "loading"}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="w-full rounded-2xl bg-gradient-to-r from-secondary to-primary px-5 py-3.5 text-base font-extrabold text-primary-foreground shadow-[0_14px_35px_-12px_var(--secondary)] disabled:opacity-80"
            >
              {status === "loading"
                ? "Building your hive…"
                : status === "success"
                  ? "Welcome to Hivez! 🎉"
                  : "Create account"}
            </motion.button>

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
              Already on Hivez?{" "}
              <Link to="/" className="link-underline font-bold text-primary">
                Log in
              </Link>
            </p>
          </form>
        </motion.section>
      </main>
    </AuthBackdrop>
  );
}
