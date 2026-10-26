import { useState } from "react";

const stories = [
  {
    label: "Notice",
    title: (
      <>
        Notice something.
        <br />
        Start something.
      </>
    ),
    description:
      "A local concern is a good place to start. Share what you see, and help others see it too.",
    image: "/auth/local-action.jpg",
    alt: "Volunteers collecting litter in a forest",
    photographer: "Ron Lach",
    source:
      "https://www.pexels.com/photo/a-cleanup-community-picking-up-recyclables-in-the-forest-9543414/",
  },
  {
    label: "Connect",
    title: (
      <>
        Find your people.
        <br />
        Make it happen.
      </>
    ),
    description:
      "Find common ground with people who care about the places and issues that matter to you.",
    image: "/auth/shared-street.jpg",
    alt: "People gathered together on a city street",
    photographer: "Gustavo Denuncio",
    source:
      "https://www.pexels.com/photo/urban-gathering-with-people-in-city-street-31998709/",
  },
  {
    label: "Act",
    title: (
      <>
        Small acts.
        <br />A better place.
      </>
    ),
    description:
      "Report a concern. Lend a hand. Be part of what happens next in your neighbourhood.",
    image: "/auth/people-together.jpg",
    alt: "A group of volunteers working together to collect litter in a grassy field",
    photographer: "Anna Shvets",
    source:
      "https://www.pexels.com/photo/volunteers-collecting-trash-on-green-grass-field-5029859/",
  },
];

/** Photographs explain Hivez's purpose; they are stock, never live activity. */
export function AuthWelcome() {
  const [selected, setSelected] = useState(2);
  const story = stories[selected];
  return (
    <aside className="ha-story" aria-label="What brings us together">
      <div className="ha-story-images">
        {stories.map((item, index) => (
          <img
            key={item.image}
            src={item.image}
            alt={index === selected ? item.alt : ""}
            aria-hidden={index !== selected}
            className={index === selected ? "is-active" : ""}
            width="1800"
            height="1200"
            loading={index === 2 ? "eager" : "lazy"}
            fetchPriority={index === 2 ? "high" : "low"}
          />
        ))}
      </div>
      <div className="ha-story-shade" />
      <div className="ha-story-content">
        <p className="ha-story-overline">Good things happen together.</p>
        <div
          className="ha-story-copy"
          key={selected}
          id="ha-story-copy"
          aria-live="polite"
        >
          <h2>{story.title}</h2>
          <p>{story.description}</p>
        </div>
        <div
          className="ha-story-controls"
          role="group"
          aria-label="Explore Hivez"
        >
          {stories.map((item, index) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setSelected(index)}
              aria-pressed={index === selected}
              aria-controls="ha-story-copy"
            >
              <span>{item.label}</span>
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <a
          className="ha-photo-credit"
          href={story.source}
          target="_blank"
          rel="noreferrer"
        >
          Photo: {story.photographer} / Pexels
        </a>
      </div>
    </aside>
  );
}
