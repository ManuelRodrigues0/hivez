import { Accessibility, Contrast, Type } from "lucide-react";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { PlannedRow, SectionTitle, SettingsSection, SettingRow } from "./settingsUi";

export default function AccessibilitySettings() {
  const reducedMotion = useReducedMotion();

  return (
    <>
      <SectionTitle title="Accessibility" />
      <SettingsSection>
        <SettingRow
          icon={Accessibility}
          title="Reduce motion"
          subtitle={`Device setting: ${reducedMotion ? "reduced motion is enabled" : "standard motion is enabled"}.`}
        >
          <span className="rounded-full bg-[#3d654c]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#3d654c] dark:bg-[#f2c14e]/15 dark:text-[#f2c14e]">
            Follows system
          </span>
        </SettingRow>
        <PlannedRow icon={Type} title="Text size" subtitle="Adjust interface text size without zooming the whole page." note="Coming soon" />
        <PlannedRow icon={Contrast} title="High contrast" subtitle="Increase the contrast of surfaces and text." note="Coming soon" />
      </SettingsSection>
    </>
  );
}