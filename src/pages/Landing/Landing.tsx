import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  Heart,
  MapPin,
  MessageCircle,
  Navigation,
  Sparkles,
} from "lucide-react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import ScrollReveal from "@/components/landing/ScrollReveal";
import { landingMedia } from "./landingMedia";
import "./Landing.css";

const hives = ["Roads", "Safety", "Events", "Pets", "Lost & Found", "Environment"];

function SocialPhone({ variant = "front" }: { variant?: "front" | "back" }) {
  return (
    <div className={`social-phone social-phone--${variant}`} aria-hidden="true">
      <div className="social-phone__bar">
        <span>Nearby</span>
        <span>now</span>
      </div>
      <div className="social-phone__media">
        <span>{variant === "front" ? "Water leak on 8th Main" : "Street cleanup at 5 PM"}</span>
      </div>
      <div className="social-phone__meta">
        <div>
          <strong>{variant === "front" ? "Maya" : "Dev"}</strong>
          <span><MapPin size={13} /> {variant === "front" ? "0.4 km" : "0.9 km"}</span>
        </div>
        <div className="social-phone__actions">
          <span><Heart size={15} /> {variant === "front" ? "284" : "96"}</span>
          <span><MessageCircle size={15} /> {variant === "front" ? "32" : "11"}</span>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="landing-page">
      <LandingNavbar />

      <main>
        <section className="hero-bereal" aria-labelledby="landing-title">
          <div className="hero-bereal__video" aria-hidden="true">
            <video autoPlay muted loop playsInline poster={landingMedia.heroPoster}>
              <source src={landingMedia.heroVideo} type="video/mp4" />
            </video>
          </div>

          <div className="hero-bereal__copy">
            <p className="hero-bereal__eyebrow anim-fade-up">HIVEZ</p>
            <h1 id="landing-title" className="anim-fade-up delay-100">
              See what's happening around you.
            </h1>
            <p className="anim-fade-up delay-200">
              A social feed for real local life. Post issues, find hives, and
              join what your community is doing right now.
            </p>
            <div className="hero-bereal__actions anim-fade-up delay-300">
              <Link to="/signup" className="landing-pill landing-pill--white">
                Join Hivez <ArrowRight size={18} />
              </Link>
              <Link to="/login" className="landing-pill landing-pill--dark">
                Log in
              </Link>
            </div>
          </div>

          <div className="hero-bereal__phones anim-scale-in delay-500">
            <SocialPhone variant="back" />
            <SocialPhone />
          </div>

          <a className="hero-bereal__scroll" href="#real" aria-label="Scroll to next section">
            <ArrowDown size={20} />
          </a>
        </section>

        <ScrollReveal>
          <section id="real" className="statement-section statement-section--white">
            <div className="statement-section__inner">
              <h2>Your neighborhood is already talking.</h2>
              <p>
                HIVEZ makes it visible. Local problems, small wins, helpful people,
                and spontaneous moments all show up in one real-time place.
              </p>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal>
          <section id="discover" className="product-section product-section--black">
            <div className="product-section__text">
              <span>Discover</span>
              <h2>Open HIVEZ. Know the street.</h2>
            </div>
            <div className="wide-post" aria-label="HIVEZ feed preview">
              <div className="wide-post__media">
                <strong>Power cut near the park</strong>
              </div>
              <div className="wide-post__body">
                <div>
                  <strong>Asha</strong>
                  <span>Koramangala - 0.6 km away</span>
                </div>
                <p>12 people nearby marked this as active.</p>
                <div className="wide-post__actions">
                  <span><Heart size={16} /> 412</span>
                  <span><MessageCircle size={16} /> 48</span>
                  <span><Navigation size={16} /> Nearby</span>
                </div>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal>
          <section id="nearby" className="split-section">
            <div className="split-section__visual" aria-hidden="true">
              <div className="nearby-orbit">
                <span className="nearby-orbit__dot nearby-orbit__dot--one" />
                <span className="nearby-orbit__dot nearby-orbit__dot--two" />
                <span className="nearby-orbit__dot nearby-orbit__dot--three" />
                <div>
                  <MapPin size={22} />
                  <strong>5 active updates</strong>
                  <span>within 1 km</span>
                </div>
              </div>
            </div>
            <div className="split-section__copy">
              <span>Nearby</span>
              <h2>Feel connected to where you are.</h2>
              <p>No corporate dashboard. Just the local feed, people, and hives that matter around you.</p>
            </div>
          </section>
        </ScrollReveal>

        <ScrollReveal>
          <section id="hives" className="hives-bereal">
            <div className="hives-bereal__heading">
              <span>Hives</span>
              <h2>Find your Hive.</h2>
            </div>
            <div className="hives-bereal__grid">
              {hives.map((hive, index) => (
                <Link to="/signup" className={`hive-chip hive-chip--${index + 1}`} key={hive}>
                  {hive}
                </Link>
              ))}
            </div>
          </section>
        </ScrollReveal>

        <section className="final-bereal" aria-labelledby="final-title">
          <Sparkles size={28} aria-hidden="true" />
          <h2 id="final-title">Be part of what's happening.</h2>
          <p>Join HIVEZ and discover your community.</p>
          <div>
            <Link to="/signup" className="landing-pill landing-pill--white">
              Join Hivez <ArrowRight size={18} />
            </Link>
            <Link to="/login" className="landing-pill landing-pill--dark">
              Log in
            </Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <strong>HIVEZ</strong>
        <nav aria-label="Footer">
          <a href="#discover">Discover</a>
          <a href="#nearby">Nearby</a>
          <a href="#hives">Hives</a>
          <Link to="/login">Login</Link>
          <Link to="/signup">Sign up</Link>
        </nav>
        <p>Copyright 2026 HIVEZ</p>
      </footer>
    </div>
  );
}
