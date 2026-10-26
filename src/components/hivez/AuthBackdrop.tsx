import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pause, Play } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import PublicThemeToggle from "@/components/common/PublicThemeToggle";
export function AuthBackdrop({
  children,
  mode,
}: {
  children: ReactNode;
  mode: "login" | "signup" | "complete";
}) {
  const { publicTheme, reducedMotion, setReducedMotion } = useTheme();
  return (
    <div className={`ha-page ha-page--${mode}`} data-public-theme={publicTheme}>
      <a
        className="ha-skip"
        href={mode === "complete" ? "#cp-form" : "#ha-form"}
      >
        Skip to form
      </a>
      <header className="ha-header">
        <Link to="/" className="ha-brand" aria-label="Hivez home">
          <svg viewBox="0 0 33 31" aria-hidden="true">
            <path d="m9 0 9 5v10l-9 5-9-5V5Z" />
            <path d="m9 11 9 5v10l-9 5-9-5V16Z" />
            <path d="m24 5.5 9 5v10l-9 5-9-5v-10Z" />
          </svg>
          hivez<span>.</span>
        </Link>
        <div className="ha-header-actions">
          <button
            className="ha-icon-button"
            type="button"
            onClick={() => setReducedMotion(!reducedMotion)}
            aria-label={
              reducedMotion ? "Enable animations" : "Pause animations"
            }
          >
            {reducedMotion ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <PublicThemeToggle className="ha-icon-button" />
          <Link
            to="/"
            className="ha-home"
            aria-label="Back to the neighbourhood"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            <span>Back to Hivez</span>
          </Link>
        </div>
      </header>
      {children}
      <footer className="ha-footer">
        <span>A little local. A lot possible.</span>
        <span>© {new Date().getFullYear()} Hivez</span>
      </footer>
    </div>
  );
}
