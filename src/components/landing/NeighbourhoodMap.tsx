import { useState } from "react";
import { ArrowUpRight, Dog, Droplets, MapPin, Trash2 } from "lucide-react";

const examples = [
  {
    title: "A cleaner corner starts here.",
    category: "Waste & clean spaces",
    detail:
      "Spot an overflowing bin. Share the location. Find neighbours ready to help.",
    icon: Trash2,
    x: 38,
    y: 42,
    colour: "lime",
  },
  {
    title: "A little attention. A safer street.",
    category: "Water & everyday issues",
    detail:
      "Bring a water leak to the community’s attention with a report and a location.",
    icon: Droplets,
    x: 72,
    y: 30,
    colour: "blue",
  },
  {
    title: "More eyes. A little more hope.",
    category: "Lost pets",
    detail:
      "Share a missing pet’s photo and where they were last seen so others can look out.",
    icon: Dog,
    x: 66,
    y: 62,
    colour: "orange",
  },
];

/** An original illustrative neighbourhood, independent of live location or data. */
export default function NeighbourhoodMap() {
  const [active, setActive] = useState(0);
  const example = examples[active];
  const Icon = example.icon;
  return (
    <div className="hz-map-experience">
      <div className="hz-map-heading">
        <span>
          <span className="hz-dot" /> AROUND YOUR CORNER
        </span>
        <span>ILLUSTRATED EXAMPLE</span>
      </div>
      <div className="hz-map-board">
        <svg
          className="hz-map-drawing"
          viewBox="0 0 600 530"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="hz-map-dots"
              width="12"
              height="12"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="0.7" fill="#777f5c" opacity=".24" />
            </pattern>
            <pattern
              id="hz-park-lines"
              width="9"
              height="9"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <path d="M0 0V9" stroke="#9da877" strokeWidth="2" />
            </pattern>
          </defs>
          <path fill="#ebe8d9" d="M0 0h600v530H0z" />
          <path fill="url(#hz-map-dots)" d="M0 0h600v530H0z" />
          <g stroke="#c9c8b5" strokeWidth="1.5" fill="#dfdfcc">
            <path d="M-20 61 128 24l32 99L9 161Z" />
            <path d="m150 18 137-32 34 100-138 35Z" />
            <path d="m207 156 113-30 29 88-116 32Z" />
            <path d="m244 276 116-30 27 84-116 32Z" />
            <path d="m32 204 126-34 29 93-127 36Z" />
            <path d="m69 337 127-33 35 112-127 33Z" />
            <path d="m342-8 108-28 39 119-113 31Z" />
            <path d="m398 151 116-33 27 91-117 31Z" />
            <path d="m448 294 126-35 33 106-124 37Z" />
            <path d="m292 402 126-35 38 121-126 34Z" />
            <path d="m-48 359 91-25 33 108-93 25Z" />
            <path d="m475 430 133-36 45 136H511Z" />
          </g>
          <g stroke="#f9f7ed" strokeWidth="27">
            <path d="M-30 191 632 14M-15 330 637 151M24 499 646 331M144-25 320 558M341-25 518 548" />
          </g>
          <g stroke="#b6b6a1" strokeWidth="1.5" strokeDasharray="5 8">
            <path d="M-30 191 632 14M-15 330 637 151M24 499 646 331M144-25 320 558M341-25 518 548" />
          </g>
          <path d="m6 207 115-31 28 88-117 33Z" fill="#c0cc95" />
          <path
            d="m6 207 115-31 28 88-117 33Z"
            fill="url(#hz-park-lines)"
            opacity=".4"
          />
          <g fill="#aebd81" stroke="#85985c" strokeWidth="1.5">
            <circle cx="56" cy="228" r="14" />
            <circle cx="91" cy="217" r="17" />
            <circle cx="72" cy="258" r="17" />
            <circle cx="111" cy="250" r="11" />
            <circle cx="337" cy="436" r="13" />
            <circle cx="371" cy="428" r="16" />
            <circle cx="357" cy="471" r="16" />
          </g>
          <g fill="#cccbb7" stroke="#b9b9a1">
            <rect
              x="221"
              y="176"
              width="35"
              height="42"
              rx="3"
              transform="rotate(-16 221 176)"
            />
            <rect
              x="270"
              y="162"
              width="36"
              height="43"
              rx="3"
              transform="rotate(-16 270 162)"
            />
            <rect
              x="441"
              y="172"
              width="47"
              height="32"
              rx="3"
              transform="rotate(-16 441 172)"
            />
            <rect
              x="91"
              y="359"
              width="75"
              height="52"
              rx="3"
              transform="rotate(-16 91 359)"
            />
          </g>
          <circle
            cx="300"
            cy="265"
            r="175"
            stroke="#53683d"
            strokeOpacity=".25"
            strokeDasharray="4 7"
          />
          <path
            className="hz-map-route"
            d="M225 230 208 171 359 130 399 274"
            stroke="#e1794b"
            strokeWidth="3"
            strokeDasharray="5 6"
            strokeLinecap="round"
          />
          <g
            fill="#71745b"
            fontFamily="monospace"
            fontSize="10"
            letterSpacing="2"
          >
            <text x="32" y="167" transform="rotate(-15 32 167)">
              EVERYDAY AVENUE
            </text>
            <text x="312" y="340" transform="rotate(-15 312 340)">
              TOGETHER STREET
            </text>
            <text x="65" y="245" fontSize="8">
              PARK
            </text>
          </g>
          <g transform="translate(526 403)" stroke="#445137">
            <path d="M0 0v40M-20 20h40" />
            <path d="m0 1-5 10h10Z" fill="#445137" />
          </g>
          <text
            x="522"
            y="394"
            fill="#445137"
            fontSize="11"
            fontFamily="monospace"
          >
            N
          </text>
        </svg>
        <div className="hz-map-stamp" aria-hidden="true">
          <span>GOOD THINGS</span>
          <span className="hz-stamp-star">✳</span>
          <span>START LOCAL</span>
        </div>
        {examples.map((item, index) => {
          const PinIcon = item.icon;
          return (
            <button
              key={item.category}
              type="button"
              className={`hz-map-pin hz-map-pin--${item.colour} ${active === index ? "is-active" : ""}`}
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
              aria-label={`Explore example: ${item.category}`}
              aria-pressed={active === index}
              aria-controls="hz-map-example"
              onClick={() => setActive(index)}
            >
              <PinIcon size={21} aria-hidden="true" />
            </button>
          );
        })}
        <div className="hz-map-you">
          <MapPin size={13} aria-hidden="true" /> A place to begin
        </div>
      </div>
      <div
        className="hz-map-story"
        id="hz-map-example"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className={`hz-map-story-icon hz-map-pin--${example.colour}`}>
          <Icon size={22} aria-hidden="true" />
        </div>
        <div>
          <span className="hz-eyebrow">{example.category}</span>
          <h2>{example.title}</h2>
          <p>{example.detail}</p>
        </div>
        <span className="hz-map-story-arrow" aria-hidden="true">
          <ArrowUpRight size={26} />
        </span>
      </div>
      <div className="hz-map-caption">
        <span>Tap a pin. See a possibility.</span>
        <span>0{active + 1} / 03</span>
      </div>
    </div>
  );
}
