import { Link } from "react-router-dom";
import {
  ArrowRight,
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
import { landingMedia } from "./landingMedia";
import "./Landing.css";

const issueTypes = [
  "Potholes",
  "Garbage",
  "Broken streetlights",
  "Water leakage",
  "Illegal parking",
  "Fallen trees",
];

const features = [
  {
    icon: Camera,
    title: "Report local issues",
    text: "Share civic concerns with photos, videos, location context, and a short description.",
  },
  {
    icon: ThumbsUp,
    title: "Raise visibility",
    text: "Upvotes, comments, and shares help important problems get noticed by the community.",
  },
  {
    icon: Users,
    title: "Discuss and support",
    text: "Neighbors can add updates, confirm reports, suggest help, and coordinate action.",
  },
  {
    icon: Bell,
    title: "Stay updated",
    text: "Notifications, search, and profiles keep people connected to what matters nearby.",
  },
];

const intelligenceFeatures = [
  "Location-based issue discovery",
  "Volunteer groups for local action",
  "AI issue detection from photos and videos",
  "Duplicate report detection",
  "Severity analysis",
  "AI-assisted resolution verification",
];

function IssuePreview() {
  return (
    <div className="issue-preview" aria-label="Hivez issue post preview">
      <div className="issue-preview__top">
        <div>
          <strong>Hivez</strong>
          <span>Nearby reports</span>
        </div>
        <Search size={18} aria-hidden="true" />
      </div>

      <article className="issue-card">
        <div className="issue-card__media">
          <span>Water leakage on 8th Main</span>
        </div>
        <div className="issue-card__body">
          <div className="issue-card__meta">
            <span><MapPin size={14} /> 0.4 km away</span>
            <span>Roads</span>
          </div>
          <p>Pipe leakage has been active since morning. Water is spreading near the bus stop.</p>
          <div className="issue-card__actions">
            <span><ThumbsUp size={15} /> 284</span>
            <span><MessageCircle size={15} /> 32</span>
            <span><Share2 size={15} /> Share</span>
          </div>
        </div>
      </article>

      <div className="mini-report-list">
        <div>
          <span className="status-dot status-dot--urgent" />
          <p>Broken streetlight near Park Road</p>
          <strong>96</strong>
        </div>
        <div>
          <span className="status-dot" />
          <p>Garbage overflow behind market</p>
          <strong>141</strong>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="landing-page">
      <header className="landing-site-nav">
        <Link to="/" className="landing-site-nav__brand">Hivez</Link>
        <nav aria-label="Landing sections">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#intelligence">Intelligence</a>
        </nav>
        <div className="landing-site-nav__actions">
          <Link to="/login">Log in</Link>
          <Link to="/signup" className="nav-signup">Sign up</Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero__content">
            <p className="landing-eyebrow">Community-driven civic social platform</p>
            <h1>Report, discover, and support local issues around you.</h1>
            <p>
              Hivez helps people share problems like potholes, garbage, broken
              streetlights, water leakage, illegal parking, and other civic concerns,
              then discuss and support them together.
            </p>
            <div className="landing-hero__actions">
              <Link to="/signup" className="landing-button landing-button--primary">
                Join Hivez <ArrowRight size={18} />
              </Link>
              <a href="#features" className="landing-button landing-button--secondary">
                Explore features
              </a>
            </div>
          </div>

          <div className="landing-hero__visual">
            <div className="hero-media" aria-hidden="true">
              <video autoPlay muted loop playsInline poster={landingMedia.heroPoster}>
                <source src={landingMedia.heroVideo} type="video/mp4" />
              </video>
            </div>
            <IssuePreview />
          </div>
        </section>

        <section className="issue-strip" aria-label="Common issues on Hivez">
          {issueTypes.map((issue) => (
            <span key={issue}>{issue}</span>
          ))}
        </section>

        <section id="features" className="landing-section">
          <div className="section-heading">
            <p className="landing-eyebrow">What Hivez does</p>
            <h2>A social feed for local action.</h2>
            <p>
              Hivez turns community problems into visible, discussable reports that
              people can support, update, and share.
            </p>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <feature.icon size={24} aria-hidden="true" />
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="landing-section landing-section--dark">
          <div className="section-heading">
            <p className="landing-eyebrow">How it works</p>
            <h2>Simple enough for everyday community use.</h2>
          </div>

          <div className="steps-grid">
            <article>
              <span>01</span>
              <h3>Post the issue</h3>
              <p>Add a photo or video, describe the problem, and share it with your community.</p>
            </article>
            <article>
              <span>02</span>
              <h3>People interact</h3>
              <p>Neighbors upvote, comment, share, and add useful context so the report gains visibility.</p>
            </article>
            <article>
              <span>03</span>
              <h3>Action becomes easier</h3>
              <p>Community members can follow updates, coordinate support, and push important issues forward.</p>
            </article>
          </div>
        </section>

        <section className="community-section">
          <div className="community-section__copy">
            <p className="landing-eyebrow">Built for communities</p>
            <h2>Profiles, search, notifications, and real interaction.</h2>
            <p>
              Hivez is not just a complaint box. It is a community layer where
              people can discover nearby concerns, connect through discussions,
              follow updates, and build local awareness together.
            </p>
            <Link to="/signup" className="landing-button landing-button--primary">
              Start with Hivez <ArrowRight size={18} />
            </Link>
          </div>
          <div className="community-panel">
            <div><Users size={20} /> User profiles</div>
            <div><Search size={20} /> Search local reports</div>
            <div><Bell size={20} /> Notifications</div>
            <div><MessageCircle size={20} /> Community comments</div>
            <div><ShieldCheck size={20} /> Support civic visibility</div>
          </div>
        </section>

        <section id="intelligence" className="landing-section">
          <div className="section-heading">
            <p className="landing-eyebrow">Built-in intelligence</p>
            <h2>Smarter tools for stronger communities.</h2>
            <p>
              Hivez helps communities detect issues faster, reduce duplicate reports,
              understand severity, coordinate volunteers, and verify whether problems
              are resolved.
            </p>
          </div>

          <div className="roadmap-grid">
            {intelligenceFeatures.map((item) => (
              <div key={item}>
                <CheckCircle2 size={20} aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="ai-callout">
            <Bot size={28} aria-hidden="true" />
            <div>
              <h3>AI-assisted civic reporting</h3>
              <p>
                Hivez uses AI assistance to identify report categories, spot duplicate
                issues, estimate severity, and help verify resolution updates.
              </p>
            </div>
          </div>
        </section>

        <section className="final-cta">
          <h2>Help your community see what matters.</h2>
          <p>Join Hivez and start discovering local issues, updates, and people around you.</p>
          <div>
            <Link to="/signup" className="landing-button landing-button--primary">
              Join Hivez <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="landing-button landing-button--secondary">
              Log in
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div>
          <strong>Hivez</strong>
          <p>Community-driven local issue reporting and discussion.</p>
        </div>
        <nav aria-label="Footer">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#intelligence">Intelligence</a>
          <Link to="/login">Login</Link>
          <Link to="/signup">Sign up</Link>
        </nav>
        <span>Copyright 2026 Hivez</span>
      </footer>
    </div>
  );
}
