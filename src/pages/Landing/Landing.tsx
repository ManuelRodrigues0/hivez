import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Bell,
  Bot,
  Camera,
  CheckCircle2,
  MapPin,
  MessageCircle,
  Search,
  Share2,
  ShieldCheck,
  ThumbsUp,
  Users,
} from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import heroStreet from "@/assets/hero-street.jpg";
import {
  AnimatedHeading,
  Marquee,
  Parallax,
  Reveal,
} from "@/components/landing/motion-primitives";
import "@/styles/landing.css";

const features = [
  {
    icon: Camera,
    title: "Report local issues",
    text: "Photos, video, location context and a short description — in under a minute.",
  },
  {
    icon: ThumbsUp,
    title: "Raise visibility",
    text: "Upvotes, comments and shares push the problems that matter to the surface.",
  },
  {
    icon: Users,
    title: "Discuss and support",
    text: "Neighbours confirm reports, add updates and coordinate real action.",
  },
  {
    icon: Bell,
    title: "Stay updated",
    text: "Notifications, search and profiles keep you close to what's happening nearby.",
  },
];

const steps = [
  {
    n: "01",
    title: "Post the issue",
    text: "Add a photo or video, describe the problem, drop the pin. It goes live to your area instantly.",
  },
  {
    n: "02",
    title: "People interact",
    text: "Neighbours upvote, comment and add context, so the report gains weight and visibility.",
  },
  {
    n: "03",
    title: "Action becomes easier",
    text: "Follow updates, rally volunteers, and verify when the problem is actually fixed.",
  },
];

const intelligence = [
  "Location-based issue discovery",
  "Volunteer groups for local action",
  "AI issue detection from photos and video",
  "Duplicate report detection",
  "Severity analysis",
  "AI-assisted resolution verification",
];

const community = [
  { icon: Users, label: "User profiles" },
  { icon: Search, label: "Search local reports" },
  { icon: Bell, label: "Notifications" },
  { icon: MessageCircle, label: "Community comments" },
  { icon: ShieldCheck, label: "Support civic visibility" },
];

function Grain() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 grain-overlay" aria-hidden="true" />
  );
}

function CtaLink({
  children,
  to,
  href,
  variant = "primary",
}: {
  children: React.ReactNode;
  to?: string;
  href?: string;
  variant?: "primary" | "ghost";
}) {
  const buttonClass =
    variant === "primary"
      ? "group inline-flex items-center gap-3 rounded-full bg-primary px-7 py-4 text-sm font-medium uppercase tracking-[0.14em] text-primary-foreground transition-transform duration-300 hover:-translate-y-0.5"
      : "group inline-flex items-center gap-3 rounded-full border border-border px-7 py-4 text-sm font-medium uppercase tracking-[0.14em] text-foreground transition-colors duration-300 hover:border-foreground/40 hover:bg-secondary";

  if (to) {
    return (
      <Link to={to} className={buttonClass}>
        {children}
        <ArrowUpRight
          size={16}
          className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
        />
      </Link>
    );
  }

  return (
    <a href={href} className={buttonClass}>
      {children}
      <ArrowUpRight
        size={16}
        className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
      />
    </a>
  );
}

function IssuePreview() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between pb-4">
        <div className="flex flex-col">
          <span className="font-display text-lg uppercase">Hivez</span>
          <span className="text-xs text-muted-foreground">Nearby reports</span>
        </div>
        <Search size={16} className="text-muted-foreground" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex h-28 items-end bg-secondary p-3 text-sm font-medium">
          Water leakage on 8th Main
        </div>
        <div className="space-y-3 p-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} /> 0.4 km away
            </span>
            <span className="rounded-full bg-secondary px-2 py-0.5">Roads</span>
          </div>
          <p className="text-sm text-foreground/80">
            Pipe leakage active since morning. Water is spreading near the bus stop.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ThumbsUp size={13} /> 284
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle size={13} /> 32
            </span>
            <span className="inline-flex items-center gap-1">
              <Share2 size={13} /> Share
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {[
          { t: "Broken streetlight near Park Road", v: 96, urgent: true },
          { t: "Garbage overflow behind market", v: 141, urgent: false },
        ].map((r) => (
          <div
            key={r.t}
            className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-xs"
          >
            <span
              className={`size-1.5 rounded-full ${r.urgent ? "bg-destructive" : "bg-accent"}`}
            />
            <p className="flex-1 text-foreground/75">{r.t}</p>
            <strong>{r.v}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const heroFade = useTransform(scrollYProgress, [0, 1], [1, 0.35]);

  return (
    <div className="landing-page">
      <Grain />

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/80 px-5 py-4 backdrop-blur-xl md:px-10">
        <Link to="/" className="font-display text-2xl uppercase">
          Hivez
        </Link>
        <nav className="hidden gap-8 text-xs uppercase tracking-[0.16em] text-muted-foreground md:flex">
          {[
            ["Features", "#features"],
            ["How it works", "#how"],
            ["Intelligence", "#intelligence"],
          ].map(([label, href]) => (
            <a key={href} href={href} className="transition-colors hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <Link
          to="/signup"
          className="rounded-full bg-primary px-5 py-2.5 text-xs uppercase tracking-[0.14em] text-primary-foreground"
        >
          Join
        </Link>
      </header>

      <main id="top">
        {/* HERO */}
        <section
          ref={heroRef}
          className="relative grid items-center gap-10 px-5 pb-16 pt-14 md:grid-cols-[1.05fr_0.95fr] md:px-10 md:pb-28 md:pt-20"
        >
          <div>
            <Reveal>
              <p className="mb-6 text-xs font-medium uppercase tracking-[0.24em] text-accent">
                Community-driven civic platform
              </p>
            </Reveal>
            <AnimatedHeading
              as="h1"
              text="Report. Discover. Fix your street."
              className="font-display text-[clamp(3rem,9vw,7.5rem)] uppercase"
            />
            <Reveal delay={0.35} className="mt-8 max-w-xl">
              <p className="text-lg text-muted-foreground">
                Potholes, garbage, broken streetlights, water leakage, illegal parking — post it
                once, and let your neighbourhood carry it forward.
              </p>
            </Reveal>
            <Reveal delay={0.5} className="mt-10 flex flex-wrap gap-3">
              <CtaLink to="/signup">Join Hivez</CtaLink>
              <CtaLink href="#features" variant="ghost">
                Explore
              </CtaLink>
            </Reveal>
            <Reveal delay={0.65} className="mt-14 flex gap-10 border-t border-border pt-6">
              {[
                ["12.4k", "Reports posted"],
                ["380+", "Neighbourhoods"],
                ["71%", "Marked resolved"],
              ].map(([n, l]) => (
                <div key={l}>
                  <p className="font-display text-3xl">{n}</p>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{l}</p>
                </div>
              ))}
            </Reveal>
          </div>

          <div className="relative">
            <motion.div
              className="overflow-hidden rounded-3xl"
              initial={{ clipPath: "inset(12% 12% 12% 12% round 24px)", opacity: 0 }}
              animate={{ clipPath: "inset(0% 0% 0% 0% round 24px)", opacity: 1 }}
              transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
              style={{ opacity: heroFade }}
            >
              <motion.img
                src={heroStreet}
                alt="Neighbours gathered around a flooded pothole on their street at golden hour"
                width={1408}
                height={1760}
                className="h-[58vh] w-full object-cover md:h-[76vh]"
                style={{ scale: heroScale }}
              />
            </motion.div>
            <motion.div
              className="absolute -bottom-10 -left-4 hidden md:block"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <IssuePreview />
            </motion.div>
          </div>
        </section>

        {/* MARQUEE */}
        <section className="border-y border-border bg-secondary/40">
          <Marquee
            items={[
              "Potholes",
              "Garbage",
              "Streetlights",
              "Water leakage",
              "Illegal parking",
              "Fallen trees",
            ]}
          />
        </section>

        {/* FEATURES */}
        <section id="features" className="px-5 py-24 md:px-10 md:py-36">
          <div className="max-w-3xl">
            <Reveal>
              <p className="mb-5 text-xs uppercase tracking-[0.24em] text-accent">
                What Hivez does
              </p>
            </Reveal>
            <AnimatedHeading
              text="A social feed for local action."
              className="font-display text-[clamp(2.4rem,6vw,5rem)] uppercase"
            />
          </div>

          <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <article className="group h-full bg-background p-8 transition-colors duration-500 hover:bg-secondary">
                  <f.icon
                    size={22}
                    className="text-accent transition-transform duration-500 group-hover:-translate-y-1"
                  />
                  <h3 className="mt-8 font-display text-2xl uppercase">{f.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">{f.text}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </section>

        {/* HOW — dark */}
        <section id="how" className="bg-primary px-5 py-24 text-primary-foreground md:px-10 md:py-36">
          <div className="max-w-3xl">
            <Reveal>
              <p className="mb-5 text-xs uppercase tracking-[0.24em] text-accent">How it works</p>
            </Reveal>
            <AnimatedHeading
              text="Simple enough for everyday use."
              className="font-display text-[clamp(2.4rem,6vw,5rem)] uppercase"
            />
          </div>

          <div className="mt-20 grid gap-14 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={i * 0.1}>
                <div className="border-t border-primary-foreground/20 pt-6">
                  <span className="font-display text-6xl text-primary-foreground/25">{s.n}</span>
                  <h3 className="mt-6 font-display text-2xl uppercase">{s.title}</h3>
                  <p className="mt-3 text-sm text-primary-foreground/65">{s.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* COMMUNITY */}
        <section className="grid items-center gap-14 px-5 py-24 md:grid-cols-2 md:px-10 md:py-36">
          <div>
            <Reveal>
              <p className="mb-5 text-xs uppercase tracking-[0.24em] text-accent">
                Built for communities
              </p>
            </Reveal>
            <AnimatedHeading
              text="Not a complaint box. A community layer."
              className="font-display text-[clamp(2.2rem,5vw,4.2rem)] uppercase"
            />
            <Reveal delay={0.3} className="mt-8 max-w-lg">
              <p className="text-muted-foreground">
                Discover nearby concerns, connect through discussion, follow updates and build local
                awareness together — with profiles, search and notifications built in.
              </p>
            </Reveal>
            <Reveal delay={0.4} className="mt-10">
              <CtaLink to="/signup">Start with Hivez</CtaLink>
            </Reveal>
          </div>

          <Parallax distance={40}>
            <div className="grid gap-3">
              {community.map((c, i) => (
                <Reveal key={c.label} delay={i * 0.06}>
                  <div className="group flex items-center gap-4 rounded-xl border border-border bg-card px-6 py-5 transition-all duration-500 hover:translate-x-2 hover:border-foreground/25">
                    <c.icon size={18} className="text-accent" />
                    <span className="text-sm uppercase tracking-[0.12em]">{c.label}</span>
                    <ArrowUpRight
                      size={14}
                      className="ml-auto opacity-0 transition-opacity duration-500 group-hover:opacity-60"
                    />
                  </div>
                </Reveal>
              ))}
            </div>
          </Parallax>
        </section>

        {/* INTELLIGENCE */}
        <section id="intelligence" className="px-5 pb-24 md:px-10 md:pb-36">
          <div className="max-w-3xl">
            <Reveal>
              <p className="mb-5 text-xs uppercase tracking-[0.24em] text-accent">
                Built-in intelligence
              </p>
            </Reveal>
            <AnimatedHeading
              text="Smarter tools for stronger streets."
              className="font-display text-[clamp(2.4rem,6vw,5rem)] uppercase"
            />
          </div>

          <div className="mt-14 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {intelligence.map((item, i) => (
              <Reveal key={item} delay={i * 0.05}>
                <div className="flex items-center gap-3 border-t border-border py-5 text-sm">
                  <CheckCircle2 size={17} className="text-accent" />
                  <span>{item}</span>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2} className="mt-14">
            <div className="flex flex-col gap-5 rounded-2xl border border-border bg-secondary/50 p-8 md:flex-row md:items-center md:p-10">
              <Bot size={30} className="text-accent" />
              <div>
                <h3 className="font-display text-2xl uppercase">AI-assisted civic reporting</h3>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  Hivez identifies report categories, spots duplicates, estimates severity, and helps
                  verify resolution updates — so real problems don't get lost in noise.
                </p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* FINAL CTA */}
        <section
          id="join"
          className="border-t border-border px-5 py-28 text-center md:px-10 md:py-40"
        >
          <div className="mx-auto max-w-4xl">
            <AnimatedHeading
              text="Help your community see what matters."
              className="font-display text-[clamp(2.6rem,7.5vw,6.5rem)] uppercase"
            />
            <Reveal delay={0.3} className="mt-8">
              <p className="mx-auto max-w-xl text-muted-foreground">
                Join Hivez and start discovering local issues, updates and people around you.
              </p>
            </Reveal>
            <Reveal delay={0.4} className="mt-10 flex flex-wrap justify-center gap-3">
              <CtaLink to="/signup">Join Hivez</CtaLink>
              <CtaLink href="#features" variant="ghost">
                See features
              </CtaLink>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-5 py-12 md:px-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <p className="font-display text-3xl uppercase">Hivez</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Community-driven local issue reporting and discussion.
            </p>
          </div>
          <nav className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#intelligence" className="hover:text-foreground">
              Intelligence
            </a>
            <a href="#join" className="hover:text-foreground">
              Join
            </a>
          </nav>
          <span className="text-xs text-muted-foreground">© 2026 Hivez</span>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
