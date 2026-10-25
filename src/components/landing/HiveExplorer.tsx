import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Dog, Droplets, Route, Sprout } from "lucide-react";

const interests = [
  {
    title: "Cleaner spaces",
    icon: Sprout,
    heading: "A little care for the places we share.",
    description:
      "Bring attention to waste, find others who want cleaner surroundings, and organise a local effort.",
    words: ["Less litter.", "More together."],
    tags: ["Waste reports", "Community discussions", "Volunteer activities"],
  },
  {
    title: "Safer streets",
    icon: Route,
    heading: "Your everyday route matters.",
    description:
      "Share road damage and local hazards. Add the context that helps your community understand the concern.",
    words: ["Notice it.", "Make it visible."],
    tags: ["Road issues", "Location-based discovery", "Community updates"],
  },
  {
    title: "Lost pets",
    icon: Dog,
    heading: "A familiar face. A wider search.",
    description:
      "Share a missing pet’s photo and last-seen details so a concern can reach more people who might help.",
    words: ["More eyes.", "More possibility."],
    tags: ["Lost pet reports", "Photos & details", "Local conversations"],
  },
  {
    title: "Water issues",
    icon: Droplets,
    heading: "Small leaks deserve attention, too.",
    description:
      "Report a water-related concern, share where it is, and keep the conversation connected to progress.",
    words: ["One report.", "A shared concern."],
    tags: ["Water reports", "Nearby discovery", "Progress updates"],
  },
];

export default function HiveExplorer() {
  const [active, setActive] = useState(0);
  const interest = interests[active];
  const Icon = interest.icon;
  return (
    <section
      className="hz-hives hz-section"
      id="hives"
      aria-labelledby="hz-hives-title"
    >
      <div className="hz-section-heading" data-reveal>
        <span className="hz-eyebrow">03 / FIND YOUR PEOPLE</span>
        <h2 id="hz-hives-title">
          Different concerns.
          <br />
          Common ground<span className="hz-accent-dot">.</span>
        </h2>
        <p>
          A Hive brings people together around a shared topic.
          <br />
          Start with something you care about.
        </p>
      </div>
      <div
        className="hz-hive-tabs"
        role="group"
        aria-label="Explore community topics"
      >
        {interests.map((item, index) => {
          const TabIcon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              aria-pressed={active === index}
              aria-controls="hz-hive-content"
              onClick={() => setActive(index)}
              className={active === index ? "is-active" : ""}
            >
              <TabIcon size={19} aria-hidden="true" />
              {item.title}
              <ArrowUpRight size={16} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div
        className="hz-hive-content"
        id="hz-hive-content"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="hz-hive-poster">
          <div className="hz-hive-poster-top">
            <span className="hz-eyebrow">SHARED INTERESTS. SHARED ENERGY.</span>
            <Icon size={27} aria-hidden="true" />
          </div>
          <div className="hz-hive-poster-art" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <Icon strokeWidth={1.1} />
          </div>
          <p>
            {interest.words[0]}
            <br />
            <em>{interest.words[1]}</em>
          </p>
          <span className="hz-eyebrow">AN ILLUSTRATION OF WHAT’S POSSIBLE</span>
        </div>
        <div className="hz-hive-copy">
          <span className="hz-eyebrow">EXPLORE / {interest.title}</span>
          <h3>{interest.heading}</h3>
          <p>{interest.description}</p>
          <ul>
            {interest.tags.map((tag) => (
              <li key={tag}>
                <span aria-hidden="true">↗</span>
                {tag}
              </li>
            ))}
          </ul>
          <Link to="/signup" className="hz-text-link">
            Find your hive <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
          <span className="hz-hive-signup-note">
            Create an account to explore Hivez.
          </span>
        </div>
      </div>
    </section>
  );
}
