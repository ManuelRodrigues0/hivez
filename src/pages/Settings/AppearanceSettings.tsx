import { Moon, Sparkles, Sun, Type } from "lucide-react";

import { useTheme } from "@/context/ThemeContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { PlannedRow, SectionTitle, SettingsSection, SettingRow } from "./settingsUi";

export default function AppearanceSettings() {
  const { theme, toggleTheme } = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <>
      <SectionTitle title="Theme" />
      <SettingsSection>
        <SettingRow
          icon={theme === "dark" ? Moon : Sun}
          title={theme === "dark" ? "Dark mode" : "Light mode"}
          subtitle="Switch Hivez between light and dark appearance."
        >
          <div className="grid shrink-0 grid-cols-2 rounded-xl bg-[#f7f7f2] p-1 dark:bg-[#1a1a1a]">
            <button
              type="button"
              onClick={() => {
                if (theme !== "light") toggleTheme();
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                theme === "light"
                  ? "bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]"
                  : "text-[#1c1d1a]/60 dark:text-neutral-400"
              }`}
            >
              Light
            </button>
            <button
              type="button"
              onClick={() => {
                if (theme !== "dark") toggleTheme();
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                theme === "dark"
                  ? "bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]"
                  : "text-[#1c1d1a]/60 dark:text-neutral-400"
              }`}
            >
              Dark
            </button>
          </div>
        </SettingRow>
        <PlannedRow
          icon={Sun}
          title="System theme"
          subtitle="Automatically follow your device appearance."
          note="Coming soon"
        />
      </SettingsSection>

      <SectionTitle title="Typography & motion" />
      <SettingsSection>
        <PlannedRow icon={Type} title="Font size" subtitle="Adjust text size across Hivez." note="Coming soon" />
        <SettingRow
          icon={Sparkles}
          title="Reduce motion"
          subtitle={`Your device preference: ${reducedMotion ? "reduced motion is on" : "standard motion is on"}.`}
        >
          <span className="rounded-full bg-[#1c1d1a]/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#1c1d1a]/45 dark:bg-white/10 dark:text-neutral-400">
            Follows system
          </span>
        </SettingRow>
      </SettingsSection>
    </>
  );
}