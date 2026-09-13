import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import type { ReactNode } from "react";

type Theme = "dark" | "light" | "system";
type FontSize = "small" | "default" | "large";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  reducedMotion: boolean;
  setReducedMotion: (reduced: boolean) => void;
  highContrast: boolean;
  setHighContrast: (high: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  resolvedTheme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
  fontSize: "default",
  setFontSize: () => {},
  reducedMotion: false,
  setReducedMotion: () => {},
  highContrast: false,
  setHighContrast: () => {},
});

const TRANSITION_DURATION = 520;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

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
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem("hivez-theme");
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "dark";
  });
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const saved = localStorage.getItem("hivez-font-size");
    return saved === "small" || saved === "large" ? saved : "default";
  });
  const [reducedMotion, setReducedMotionState] = useState<boolean>(() => {
    const saved = localStorage.getItem("hivez-reduced-motion");
    if (saved === "true") return true;
    if (saved === "false") return false;
    // Default to system preference
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [highContrast, setHighContrastState] = useState<boolean>(() => {
    return localStorage.getItem("hivez-high-contrast") === "true";
  });
  const animating = useRef(false);

  // Compute resolved theme (system → actual)
  const resolvedTheme: "dark" | "light" = theme === "system" ? getSystemTheme() : theme;

  // Keep the DOM class + storage in sync
  useEffect(() => {
    localStorage.setItem("hivez-theme", theme);
    applyThemeClass(resolvedTheme);
  }, [theme, resolvedTheme]);

  // Apply font size
  useEffect(() => {
    localStorage.setItem("hivez-font-size", fontSize);
    const root = document.documentElement;
    const sizes: Record<FontSize, string> = { small: "14px", default: "16px", large: "18px" };
    root.style.fontSize = sizes[fontSize];
  }, [fontSize]);

  // Apply reduced motion
  useEffect(() => {
    localStorage.setItem("hivez-reduced-motion", String(reducedMotion));
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);

  // Apply high contrast
  useEffect(() => {
    localStorage.setItem("hivez-high-contrast", String(highContrast));
    document.documentElement.classList.toggle("high-contrast", highContrast);
  }, [highContrast]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeClass(getSystemTheme());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const setFontSize = useCallback((size: FontSize) => {
    setFontSizeState(size);
  }, []);

  const setReducedMotion = useCallback((reduced: boolean) => {
    setReducedMotionState(reduced);
  }, []);

  const setHighContrast = useCallback((high: boolean) => {
    setHighContrastState(high);
  }, []);

  const toggleTheme = () => {
    if (animating.current) return;
    // Toggle cycles: dark → light → (system if was system, otherwise dark)
    const next: Theme = resolvedTheme === "dark" ? "light" : "dark";

    const userReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches || reducedMotion;
    const startViewTransition = (
      document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> } }
    ).startViewTransition?.bind(document);

    if (userReduced || !startViewTransition) {
      if (!userReduced) runFallbackWipe(next);
      setThemeState(next);
      return;
    }

    animating.current = true;
    const { x, y, radius } = getOrigin();
    const root = document.documentElement;
    root.classList.add("theme-switching");

    const transition = startViewTransition(() => {
      flushSync(() => {
        applyThemeClass(next);
        setThemeState(next);
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
    <ThemeContext.Provider value={{
      theme,
      resolvedTheme,
      toggleTheme,
      setTheme,
      fontSize,
      setFontSize,
      reducedMotion,
      setReducedMotion,
      highContrast,
      setHighContrast,
    }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}