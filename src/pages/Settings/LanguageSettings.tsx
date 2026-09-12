import { Check, Languages } from "lucide-react";

import { SectionTitle, SettingsSection } from "./settingsUi";

const LANGUAGES = [
  { code: "en-US", label: "English (US)", available: true },
  { code: "hi-IN", label: "हिन्दी (Hindi)", available: false },
  { code: "ta-IN", label: "தமிழ் (Tamil)", available: false },
];

export default function LanguageSettings() {
  return (
    <>
      <SectionTitle title="Language" />
      <SettingsSection>
        {LANGUAGES.map((lang) => (
          <div
            key={lang.code}
            className="flex w-full items-center gap-3.5 border-b border-[#1c1d1a]/5 py-3.5 last:border-b-0 dark:border-neutral-800/60"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-[#f2c14e]">
              <Languages size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">{lang.label}</p>
              <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#1c1d1a]/55 dark:text-neutral-400">
                {lang.available ? "Currently active" : "Localized UI not available yet"}
              </p>
            </div>
            {lang.available ? (
              <Check size={16} className="text-[#3d654c] dark:text-[#f2c14e]" />
            ) : (
              <span className="rounded-full bg-[#1c1d1a]/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#1c1d1a]/45 dark:bg-white/10 dark:text-neutral-400">
                Soon
              </span>
            )}
          </div>
        ))}
      </SettingsSection>
    </>
  );
}