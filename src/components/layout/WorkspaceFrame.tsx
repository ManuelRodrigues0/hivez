import type { ReactNode } from "react";
import { useTheme } from "@/context/ThemeContext";
import "@/styles/workspace.css";

/** Scopes the signed-in visual system away from public and onboarding pages. */
export default function WorkspaceFrame({
  children,
  className = "",
  dark = false,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  return (
    <div
      className={`hv-app app-shell hv-standalone ${className}`}
      data-app-theme={dark ? "dark" : resolvedTheme}
    >
      {children}
    </div>
  );
}
