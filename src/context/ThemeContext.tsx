import { createContext, useContext, useEffect, useRef, useState } from "react";
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

/** Circular color wipe overlay - works on all devices. */
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

    if (prefersReduced) {
      setTheme(next);
      return;
    }

    // Use the same circular wipe on ALL devices (desktop + mobile)
    animating.current = true;
    runFallbackWipe(next);
    setTheme(next);
    window.setTimeout(() => {
      animating.current = false;
    }, TRANSITION_DURATION + 60);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}