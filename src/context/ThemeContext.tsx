import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (event?: React.MouseEvent<HTMLButtonElement>) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

function ensureThemeTransitionElement() {
  let overlay = document.getElementById("hivez-theme-transition-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "hivez-theme-transition-overlay";
    document.body.appendChild(overlay);
  }

  return overlay;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("hivez-theme");
    return (saved === "light" || saved === "dark") ? saved : "dark";
  });

  useEffect(() => {
    const newColor = theme === "dark" ? "#050505" : "#f6f4ee";

    localStorage.setItem("hivez-theme", theme);
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(theme);

    const overlay = ensureThemeTransitionElement();
    
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    
    const storedX = sessionStorage.getItem("theme-transition-x");
    const storedY = sessionStorage.getItem("theme-transition-y");
    
    if (storedX && storedY) {
      x = parseFloat(storedX);
      y = parseFloat(storedY);
      sessionStorage.removeItem("theme-transition-x");
      sessionStorage.removeItem("theme-transition-y");
    }
    
    overlay.style.setProperty("--theme-x", `${x}px`);
    overlay.style.setProperty("--theme-y", `${y}px`);
    overlay.style.background = newColor;
    overlay.classList.remove("is-active");
    void overlay.offsetWidth;
    overlay.classList.add("is-active");

    const timeout = window.setTimeout(() => {
      overlay.classList.remove("is-active");
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [theme]);

  const toggleTheme = (event?: React.MouseEvent<HTMLButtonElement>) => {
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      sessionStorage.setItem("theme-transition-x", x.toString());
      sessionStorage.setItem("theme-transition-y", y.toString());
    }
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}