import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  HeartHandshake,
  MoveUpRight,
  Plus,
} from "lucide-react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import BeeRoamer from "@/components/landing/BeeRoamer";
import NeighbourhoodMap from "@/components/landing/NeighbourhoodMap";
import ActionJourney from "@/components/landing/ActionJourney";
import HiveExplorer from "@/components/landing/HiveExplorer";
import { useTheme } from "@/context/ThemeContext";
import neighbourhoodPhoto from "@/assets/hero-street.jpg";
import "@/styles/landing.css";

const questions = [
  {
    question: "What can I do on Hivez?",
    answer:
      "Report a local issue, discover nearby concerns, join Hives around shared interests, talk with your community, and take part in volunteering. Create an account to get started.",
  },
  {
    question: "What happens after I share a report?",
    answer:
      "A report helps make a concern visible. Others can discover it, add context, join the related community, and coordinate next steps. Community updates and evidence help keep people informed as the issue progresses.",
  },
  {
    question: "Do I need to organise something to help?",
    answer:
      "You can begin by reading, sharing useful context, or joining an existing volunteer activity. If you want to bring people together, Hivez also supports organising activities and volunteer groups.",
  },
  {
    question: "How does report checking work?",
    answer:
      "Hivez uses media checks to help assess whether evidence is relevant to a report’s category. These checks assist the process; community context, evidence, and review remain important. A report is not a guarantee that an issue will be resolved.",
  },
];

export default function Landing() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { reducedMotion, publicTheme } = useTheme();

  useEffect(() => {
    const title = document.title;
    document.title = "Hivez — Small acts. Big local change.";
    const existing = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const description = existing || document.createElement("meta");
    const previous = description.content;
    description.name = "description";
    description.content =
      "Report local issues, find people who care, and turn shared concerns into community action. Discover your neighbourhood on Hivez.";
    if (!existing) document.head.append(description);
    return () => {
      document.title = title;
      if (existing) description.content = previous;
      else description.remove();
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    root.classList.add("hz-reveal-ready");
    root
      .querySelectorAll("[data-reveal]")
      .forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
      root.classList.remove("hz-reveal-ready");
    };
  }, [reducedMotion]);

  return (
    <div ref={rootRef} className="hz-landing" data-public-theme={publicTheme}>
      <a href="#hz-main" className="hz-skip-link">
        Skip to content
      </a>
      <BeeRoamer />
      <LandingNavbar />
      <main id="hz-main" tabIndex={-1}>
        <section className="hz-hero" aria-labelledby="hz-hero-title">
          <div className="hz-hero-copy">
            <div className="hz-eyebrow hz-hero-eyebrow">
              <span className="hz-dot" /> A LITTLE LOCAL. A LOT POSSIBLE.
            </div>
            <h1 id="hz-hero-title">
              Small acts.
              <br />
              Big local
              <br />
              <span className="hz-change">
                change
                <svg
                  viewBox="0 0 420 23"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M4 14Q190-4 411 9M18 20Q218 6 416 17" />
                </svg>
              </span>
              <span className="hz-hero-period">.</span>
            </h1>
            <p>
              That thing you walk past every day?
              <br className="hz-desktop-break" /> It could be the start of
              something better.
            </p>
            <p className="hz-hero-explainer">
              Report local issues. Find people who care.
              <br />
              Turn a shared concern into community action.
            </p>
            <div className="hz-hero-actions">
              <Link to="/signup" className="hz-button">
                Find your people <ArrowUpRight size={21} aria-hidden="true" />
              </Link>
              <a href="#how" className="hz-text-link">
                See how it works <ArrowDown size={18} aria-hidden="true" />
              </a>
            </div>
            <div className="hz-hero-footnote">
              <span className="hz-tiny-hive" aria-hidden="true">
                ✳
              </span>
              <span>
                For your street. Your neighbourhood.
                <br />
                <strong>Your kind of change.</strong>
              </span>
            </div>
          </div>
          <div id="nearby" className="hz-hero-map">
            <NeighbourhoodMap />
          </div>
          <a href="#discover" className="hz-scroll-cue">
            <ArrowDown size={16} aria-hidden="true" />
            <span>THERE’S MORE TOGETHER</span>
            <span>SCROLL TO EXPLORE</span>
          </a>
        </section>
        <section
          className="hz-manifesto"
          id="discover"
          aria-labelledby="hz-idea-title"
        >
          <div className="hz-manifesto-meta">
            <span className="hz-eyebrow">01 / THE IDEA IS SIMPLE</span>
            <span className="hz-eyebrow">HIVEZ / PEOPLE MAKE THE PLACE</span>
          </div>
          <h2 id="hz-idea-title" data-reveal>
            A better neighbourhood
            <br />
            doesn’t start with <em>everyone.</em>
            <br />
            It starts with <span>someone.</span>
            <svg viewBox="0 0 150 120" aria-hidden="true">
              <path d="M4 16c88-19 140 5 119 60-10 26-45 34-64 8-14-21 9-43 35-23l35 28M99 91l32 2 1-33" />
            </svg>
          </h2>
          <div className="hz-manifesto-bottom">
            <span className="hz-manifesto-star" aria-hidden="true">
              ✳
            </span>
            <p>
              Hivez connects what you notice with people who care. <br />A place
              to share a concern, find common ground, <br />
              and take the next step together.
            </p>
            <span className="hz-manifesto-note">
              THAT SOMEONE
              <br />
              COULD BE YOU. ↗
            </span>
          </div>
        </section>
        <div id="features" className="hz-anchor" />
        <ActionJourney />
        <HiveExplorer />
        <section
          className="hz-community"
          id="community"
          aria-labelledby="hz-community-title"
        >
          <div className="hz-community-photo">
            <img
              src={neighbourhoodPhoto}
              width="1408"
              height="1760"
              loading="lazy"
              decoding="async"
              alt="Neighbours gathered on a residential street beside a waterlogged stretch of road"
            />
            <span className="hz-photo-label">
              OUR SHARED SPACES. OUR SHARED RESPONSIBILITY.
            </span>
            <div className="hz-photo-sticker" aria-hidden="true">
              BE THE
              <br />
              <span>“LET’S”</span>
              <br />
              IN “LET’S DO IT.”
              <MoveUpRight size={34} />
            </div>
          </div>
          <div className="hz-community-copy">
            <span className="hz-eyebrow">04 / GOOD THINGS TAKE PEOPLE</span>
            <HeartHandshake
              className="hz-community-symbol"
              strokeWidth={1}
              size={70}
              aria-hidden="true"
            />
            <h2 id="hz-community-title" data-reveal>
              Less “someone
              <br />
              should.”
              <br />
              <em>More “I’m in.”</em>
            </h2>
            <p>
              You don’t need all the answers to make a difference. Sometimes
              it’s a useful detail. Sometimes it’s showing up.
            </p>
            <ul>
              <li>
                <Check size={18} aria-hidden="true" /> Discover volunteer
                activities
              </li>
              <li>
                <Check size={18} aria-hidden="true" /> Connect through community
                conversations
              </li>
              <li>
                <Check size={18} aria-hidden="true" /> Share the progress you
                make together
              </li>
            </ul>
            <Link to="/signup" className="hz-text-link">
              Be part of the next step{" "}
              <ArrowUpRight size={21} aria-hidden="true" />
            </Link>
            <span className="hz-community-aside">
              Big on community. Open to your contribution.
            </span>
          </div>
        </section>
        <section
          className="hz-faq hz-section"
          id="intelligence"
          aria-labelledby="hz-faq-title"
        >
          <div>
            <span className="hz-eyebrow">A FEW THINGS, BEFORE YOU BEGIN</span>
            <h2 id="hz-faq-title">
              Good questions<span className="hz-accent-dot">.</span>
              <br />
              Honest answers.
            </h2>
            <p>Getting involved starts with understanding.</p>
          </div>
          <div className="hz-faq-list">
            {questions.map((item, index) => (
              <details key={item.question}>
                <summary>
                  <span className="hz-faq-number">0{index + 1}</span>
                  {item.question}
                  <Plus size={19} aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section
          className="hz-invitation"
          aria-labelledby="hz-invitation-title"
        >
          <div className="hz-invitation-top">
            <span className="hz-eyebrow">
              YOUR NEIGHBOURHOOD IS A WORK IN PROGRESS.
            </span>
            <span className="hz-eyebrow">SO LET’S GET TO WORK.</span>
          </div>
          <div className="hz-invitation-main">
            <h2 id="hz-invitation-title">
              Your corner.
              <br />
              <em>Our collective.</em>
            </h2>
            <Link to="/signup" className="hz-join-circle">
              <ArrowUpRight size={51} strokeWidth={1.3} aria-hidden="true" />
              <span>Join the hive</span>
            </Link>
          </div>
          <div className="hz-invitation-bottom">
            <span>A small act is a good place to start.</span>
            <Link to="/login">
              Already part of Hivez? Log in{" "}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <footer className="hz-footer">
        <div className="hz-footer-top">
          <Link to="/" className="hz-wordmark" aria-label="Hivez home">
            hivez.
          </Link>
          <p>
            Made for the places we share.
            <br />
            Moved by the people who care.
          </p>
          <nav aria-label="Footer">
            <a href="#how">How it works</a>
            <a href="#hives">Find your hive</a>
            <Link to="/signup">
              Get involved <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          </nav>
          <a href="#hz-main" className="hz-back-top" aria-label="Back to top">
            <ArrowUpRight size={26} aria-hidden="true" />
          </a>
        </div>
        <div className="hz-footer-large" aria-hidden="true">
          hivez<span>✳</span>
        </div>
        <div className="hz-footer-bottom">
          <span>© {new Date().getFullYear()} Hivez</span>
          <span>LOCAL CONCERNS. COLLECTIVE POSSIBILITIES.</span>
          <span>SEE YOU AROUND THE NEIGHBOURHOOD. ↗</span>
        </div>
      </footer>
    </div>
  );
}
