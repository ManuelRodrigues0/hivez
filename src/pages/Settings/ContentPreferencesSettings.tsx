import { useState } from "react";
import { Eye, Globe, Hash, HeartHandshake } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import {
  saveSensitiveContentPreference,
  sensitiveContentPreference,
  type SensitiveContentPreference,
} from "@/services/privacy";
import { OptionRow, PlannedRow, SectionTitle, SettingsSection } from "./settingsUi";

export default function ContentPreferencesSettings() {
  const { user, profile } = useAuth();
  const [contentPref, setContentPref] = useState<SensitiveContentPreference>(() =>
    sensitiveContentPreference(profile)
  );

  async function updatePreference(value: SensitiveContentPreference) {
    if (!user) return;
    // Optimistically apply; roll back on failure.
    const previous = contentPref;
    setContentPref(value);
    try {
      await saveSensitiveContentPreference(user.uid, value);
    } catch (error) {
      console.error("Failed to save sensitive content preference:", error);
      setContentPref(previous);
    }
  }

  return (
    <>
      <SectionTitle title="Content" />
      <SettingsSection>
        <OptionRow
          icon={Eye}
          title="Sensitive content"
          subtitle="How posts the author flagged as sensitive appear to you."
          options={[
            { value: "show" as SensitiveContentPreference, label: "Show" },
            { value: "blur" as SensitiveContentPreference, label: "Blur" },
            { value: "hide" as SensitiveContentPreference, label: "Hide" },
          ]}
          value={contentPref}
          onChange={(value) => void updatePreference(value)}
        />
      </SettingsSection>

      <SectionTitle title="Preferences" />
      <SettingsSection>
        <PlannedRow
          icon={Globe}
          title="Languages"
          subtitle="Which languages you prefer seeing on Hivez."
          note="Coming soon"
        />
        <PlannedRow icon={Hash} title="Topics" subtitle="Topics you follow for a more relevant feed." note="Coming soon" />
        <PlannedRow
          icon={HeartHandshake}
          title="Interests"
          subtitle="Personalised volunteering and community interests."
          note="Coming soon"
        />
      </SettingsSection>
    </>
  );
}