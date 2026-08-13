import { createContext, useContext, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

const TRANSITION_DURATION = 520;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Lower-left origin (matches the reference video), responsive to any viewport. */
function getOrigin() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const x = w * 0.12;
  const y = h * 0.86;
  // Radius large enough to always cover the farthest viewport corner.
  const radius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
  return { x, y, radius };
}

function applyThemeClass(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
}

/** Fallback for browsers without the View Transitions API: circular color wipe. */
function ensureThemeTransitionElement() {
  let overlay = document.getElementById("hivez-theme-transition-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "hivez-theme-transition-overlay";
    document.body.appendChild(overlay);
  }
  return overlay;
}

function runFallbackWipe(theme: Theme) {
  const { x, y, radius } = getOrigin();
  const overlay = ensureThemeTransitionElement();
  overlay.style.setProperty("--theme-x", `${x}px`);
  overlay.style.setProperty("--theme-y", `${y}px`);
  overlay.style.setProperty("--theme-r", `${radius}px`);
  overlay.style.background = theme === "dark" ? "#050505" : "#f6f4ee";
  overlay.classList.remove("is-active");
  void overlay.offsetWidth;
  overlay.classList.add("is-active");
  window.setTimeout(() => overlay.classList.remove("is-active"), TRANSITION_DURATION + 60);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("hivez-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
  const animating = useRef(false);

  // Keep the DOM class + storage in sync (no animation here).
  useEffect(() => {
    localStorage.setItem("hivez-theme", theme);
    applyThemeClass(theme);
  }, [theme]);

  const toggleTheme = () => {
    if (animating.current) return;
    const next: Theme = theme === "dark" ? "light" : "dark";

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const startViewTransition = (
      document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } }
    ).startViewTransition?.bind(document);

    if (prefersReduced || !startViewTransition) {
      if (!prefersReduced) runFallbackWipe(next);
      setTheme(next);
      return;
    }

    animating.current = true;
    const { x, y, radius } = getOrigin();
    const root = document.documentElement;
    // Freeze color transitions so both snapshots are the pure themes (no fade/flash).
    root.classList.add("theme-switching");

    const transition = startViewTransition(() => {
      flushSync(() => {
        applyThemeClass(next);
        setTheme(next);
      });
    });

    transition.ready
      .then(() => {
        root.animate(
          {
            clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`],
          },
          {
            duration: TRANSITION_DURATION,
            easing: EASING,
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {});

    transition.finished.finally(() => {
      root.classList.remove("theme-switching");
      animating.current = false;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}