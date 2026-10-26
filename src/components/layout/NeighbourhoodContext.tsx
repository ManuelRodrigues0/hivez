import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  HandHeart,
  MapPin,
  PencilLine,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const startingPoints = [
  {
    label: "Notice",
    question: "What's one thing on your street you wish could be better?",
    placeholder: "On my way home, I noticed...",
  },
  {
    label: "Ask",
    question:
      "What could you make happen with a little help from your neighbours?",
    placeholder: "Could we get together and...",
  },
  {
    label: "Offer",
    question: "A skill, a spare hour, a useful tip. What could you share?",
    placeholder: "I could lend a hand with...",
  },
];

function readDraft(key: string) {
  try {
    return localStorage.getItem(key)?.slice(0, 1200) || "";
  } catch {
    return "";
  }
}

function PocketNotebook({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const draftKey = `hivez:pocket-notebook:v1:${userId}`;
  const [draft, setDraft] = useState(() => readDraft(draftKey));
  const [point, setPoint] = useState(0);
  const [storage, setStorage] = useState<"saved" | "pending" | "unavailable">(
    "saved",
  );
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (storage !== "pending") return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey, draft);
        dirtyRef.current = false;
        setStorage("saved");
      } catch {
        setStorage("unavailable");
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, draftKey, storage]);

  // Flush the last keystroke when leaving before the debounce completes.
  useEffect(
    () => () => {
      if (!dirtyRef.current) return;
      try {
        localStorage.setItem(draftKey, draftRef.current);
      } catch {
        /* The editor also works without browser storage. */
      }
    },
    [draftKey],
  );

  function continueDraft() {
    if (draft.trim())
      navigate("/create", { state: { textMode: true, text: draft } });
  }

  return (
    <>
      <section className="hv-notebook" aria-labelledby="hv-notebook-title">
        <div className="hv-notebook-kicker">
          <PencilLine size={16} strokeWidth={1.5} aria-hidden="true" />
          <span>THE POCKET NOTEBOOK</span>
        </div>
        <h2 id="hv-notebook-title">
          Your next
          <br />
          <em>good idea.</em>
        </h2>
        <p className="hv-notebook-intro">
          Catch a thought before it flies away.
        </p>
        <div
          className="hv-notebook-modes"
          role="group"
          aria-label="Notebook starting point"
        >
          {startingPoints.map((item, index) => (
            <button
              key={item.label}
              type="button"
              aria-pressed={point === index}
              onClick={() => {
                setPoint(index);
                editorRef.current?.focus();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="hv-notebook-question" id="hv-notebook-question">
          {startingPoints[point].question}
        </p>
        <div className="hv-notebook-paper">
          <span className="hv-notebook-page-label" aria-hidden="true">
            A LITTLE LOCAL THINKING
          </span>
          <label className="sr-only" htmlFor="hv-local-draft">
            Your local draft
          </label>
          <textarea
            id="hv-local-draft"
            ref={editorRef}
            value={draft}
            onChange={(event) => {
              dirtyRef.current = true;
              draftRef.current = event.target.value;
              setDraft(event.target.value);
              setStorage("pending");
            }}
            placeholder={startingPoints[point].placeholder}
            aria-describedby="hv-notebook-question hv-notebook-privacy"
            maxLength={1200}
            rows={7}
          />
          <div className="hv-notebook-paper-foot">
            <span aria-live="polite">
              {storage === "pending" ? (
                "Saving..."
              ) : storage === "unavailable" ? (
                "Device saving unavailable"
              ) : draft ? (
                <>
                  <Check size={11} aria-hidden="true" /> Saved on this device
                </>
              ) : (
                "A blank page. A good start."
              )}
            </span>
            <span>{draft.length}/1200</span>
          </div>
        </div>
        <button
          type="button"
          className="hv-notebook-continue"
          disabled={!draft.trim()}
          onClick={continueDraft}
        >
          Continue as a post <ArrowUpRight size={17} aria-hidden="true" />
        </button>
        <p className="hv-notebook-privacy" id="hv-notebook-privacy">
          A draft, not a public post. You choose when to share.
        </p>
      </section>
      <nav
        className="hv-notebook-outside"
        aria-label="Step into your neighbourhood"
      >
        <p className="hv-eyebrow">TAKE IT INTO THE REAL WORLD</p>
        <Link to="/map">
          <MapPin size={17} aria-hidden="true" />
          <span>
            Look around your corner<small>Open the neighbourhood map</small>
          </span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
        <Link to="/volunteering">
          <HandHeart size={17} aria-hidden="true" />
          <span>
            Put a little good out there<small>Find a way to lend a hand</small>
          </span>
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </nav>
      <p className="hv-notebook-signoff">
        Not every idea changes the world.
        <br />
        Some just make your street a little better.
      </p>
    </>
  );
}

export default function NeighbourhoodContext() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <aside className="hv-home-context" aria-label="Your pocket notebook">
      <PocketNotebook key={user.uid} userId={user.uid} />
    </aside>
  );
}
