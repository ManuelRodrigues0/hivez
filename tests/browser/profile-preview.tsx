// Local browser fixture only. Vite's production build has no route or entry for it.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../../src/context/ThemeContext";
import CompleteProfileExperience from "../../src/pages/CompleteProfile/CompleteProfileExperience";
import "../../src/index.css";

declare global {
  interface Window {
    __profileTest: { mode: string; saved: unknown[]; uploads: string[] };
  }
}
window.__profileTest = { mode: "success", saved: [], uploads: [] };
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MemoryRouter>
      <ThemeProvider>
        <div
          role="note"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            zIndex: 200,
            background: "#111",
            color: "white",
            font: "11px Arial",
            padding: "5px 9px",
          }}
        >
          Local UI preview. No account changes are saved.
        </div>
        <CompleteProfileExperience
          displayName=""
          onUpload={async (file) => {
            window.__profileTest.uploads.push(file.name);
            await new Promise((resolve) => setTimeout(resolve, 300));
            if (window.__profileTest.mode === "upload-error")
              throw new Error("Test upload failure");
            return URL.createObjectURL(file);
          }}
          onComplete={async (draft) => {
            window.__profileTest.saved.push(draft);
            await new Promise((resolve) => setTimeout(resolve, 400));
            if (window.__profileTest.mode === "taken")
              throw Object.assign(new Error("Taken"), {
                code: "profile/username-taken",
              });
            if (window.__profileTest.mode === "save-error")
              throw new Error("Test save failure");
          }}
        />
      </ThemeProvider>
    </MemoryRouter>
  </React.StrictMode>,
);
