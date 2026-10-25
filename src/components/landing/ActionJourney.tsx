import { useState } from "react";
import {
  Camera,
  Check,
  CheckCheck,
  MapPin,
  MessageCircle,
  Users,
} from "lucide-react";

const steps = [
  {
    title: "Notice something?",
    label: "Report it",
    body: "A damaged road. A missing pet. A corner that needs care. Add a photo, a location, and the details that help others understand.",
    icon: Camera,
    note: "Make the problem visible",
    action: "A concern becomes a report.",
    tag: "01 / NOTICE",
    heading: "This corner could use some care.",
    description:
      "Waste near the park entrance. Let’s bring it to the neighbourhood’s attention.",
  },
  {
    title: "You’re probably not alone.",
    label: "Find your people",
    body: "Discover nearby reports and Hives built around shared concerns. Join the conversation, add context, and connect with people who care.",
    icon: MessageCircle,
    note: "Build a shared understanding",
    action: "A report becomes a conversation.",
    tag: "02 / CONNECT",
    heading: "Someone else noticed it, too.",
    description:
      "Neighbours can share what they know and work out a useful next step together.",
  },
  {
    title: "Turn caring into doing.",
    label: "Show up",
    body: "Find a volunteer activity or help organise one. Bring your time, your ideas, or an extra pair of hands to a local effort.",
    icon: Users,
    note: "Make room for collective action",
    action: "A conversation becomes a plan.",
    tag: "03 / PARTICIPATE",
    heading: "A shared plan. A place to start.",
    description:
      "An example clean-up activity brings a community together around one small corner.",
  },
  {
    title: "Keep the story moving.",
    label: "Share progress",
    body: "Follow community updates, contribute evidence, and see how an issue progresses. Keep everyone connected to what happens next.",
    icon: CheckCheck,
    note: "Follow through, together",
    action: "An action becomes a shared update.",
    tag: "04 / FOLLOW THROUGH",
    heading: "Good work deserves an update.",
    description:
      "Community progress and evidence help people understand what has changed and what still needs care.",
  },
];

export default function ActionJourney() {
  const [active, setActive] = useState(0);
  const step = steps[active];
  const Icon = step.icon;
  return (
    <section
      className="hz-journey hz-section"
      id="how"
      aria-labelledby="hz-journey-title"
    >
      <div className="hz-section-heading" data-reveal>
        <span className="hz-eyebrow">02 / THE RIPPLE EFFECT</span>
        <h2 id="hz-journey-title">
          A small first step.
          <br />A shared way forward<span className="hz-accent-dot">.</span>
        </h2>
        <p>
          From “someone should do something”
          <br />
          to “let’s do something, together.”
        </p>
      </div>
      <div className="hz-journey-grid">
        <div
          className="hz-steps"
          role="group"
          aria-label="Explore the Hivez journey"
        >
          {steps.map((item, index) => (
            <button
              key={item.label}
              type="button"
              className={`hz-step ${active === index ? "is-active" : ""}`}
              aria-expanded={active === index}
              aria-controls="hz-journey-panel"
              onClick={() => setActive(index)}
            >
              <span className="hz-step-number">0{index + 1}</span>
              <span>
                <span className="hz-step-label">{item.label}</span>
                <span className="hz-step-body">{item.body}</span>
              </span>
              <span className="hz-step-indicator" aria-hidden="true">
                {active === index ? "−" : "+"}
              </span>
            </button>
          ))}
        </div>
        <div
          className="hz-journey-visual"
          id="hz-journey-panel"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="hz-journey-visual-top">
            <span className="hz-eyebrow">ONE CORNER. FOUR POSSIBILITIES.</span>
            <span>EXAMPLE JOURNEY</span>
          </div>
          <div
            className={`hz-journey-orbit hz-journey-orbit--${active}`}
            aria-hidden="true"
          >
            <div className="hz-orbit-ring" />
            <span className="hz-orbit-dot hz-orbit-dot--one" />
            <span className="hz-orbit-dot hz-orbit-dot--two" />
            <span className="hz-orbit-dot hz-orbit-dot--three" />
            <div className="hz-journey-icon">
              <Icon strokeWidth={1.3} />
            </div>
            <span className="hz-orbit-caption">{step.note}</span>
          </div>
          <div className="hz-example-note">
            <span className="hz-eyebrow">{step.tag}</span>
            <h3>{step.heading}</h3>
            <p>{step.description}</p>
            <div className="hz-example-location">
              <MapPin size={13} aria-hidden="true" /> An illustrative
              neighbourhood{" "}
              <span>
                <Check size={13} aria-hidden="true" /> {step.label}
              </span>
            </div>
          </div>
          <div className="hz-journey-progress" aria-hidden="true">
            {steps.map((item, index) => (
              <span
                key={item.label}
                className={index <= active ? "is-active" : ""}
              />
            ))}
          </div>
          <p className="hz-journey-takeaway">{step.action}</p>
        </div>
      </div>
    </section>
  );
}
