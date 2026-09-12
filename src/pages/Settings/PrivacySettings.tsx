/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { AtSign, Eye, Lock, MapPin, MessageCircle, Tag } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import {
  normalizePrivacy,
  saveUserPrivacySettings,
  type InteractionPrivacy,
  type MessagePrivacy,
  type UserPrivacySettings,
} from "@/services/privacy";
import { OptionRow, PlannedRow, SectionTitle, SettingsSection, SettingRow, Switch } from "./settingsUi";

const MESSAGE_OPTIONS: { value: MessagePrivacy; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "followers", label: "Followers" },
  { value: "mutuals", label: "Mutuals" },
  { value: "nobody", label: "Nobody" },
];

const INTERACTION_OPTIONS: { value: InteractionPrivacy; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "followers", label: "Followers" },
  { value: "nobody", label: "Nobody" },
];

export default function PrivacySettings() {
  const { user, profile } = useAuth();
  const [privacy, setPrivacy] = useState<UserPrivacySettings>(() => normalizePrivacy(profile));
  const [savingKey, setSavingKey] = useState("");

  useEffect(() => {
    setPrivacy(normalizePrivacy(profile));
  }, [profile]);

  async function updatePrivacy(next: UserPrivacySettings, key: string) {
    if (!user) return;
    setPrivacy(next);
    setSavingKey(key);
    try {
      await saveUserPrivacySettings(user.uid, next);
    } finally {
      setSavingKey("");
    }
  }

  return (
    <>
      <SectionTitle title="Privacy" />
      <SettingsSection>
        <SettingRow
          icon={Lock}
          title="Account privacy"
          subtitle="Private accounts require approval before protected posts and ReHives are visible."
        >
          <div className="grid w-full max-w-[220px] grid-cols-2 rounded-xl bg-[#f7f7f2] p-1 dark:bg-[#1a1a1a]">
            {(["public", "private"] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={savingKey === "account"}
                onClick={() =>
                  updatePrivacy(
                    {
                      ...privacy,
                      account: value,
                      messages:
                        value === "private" && privacy.messages === "everyone" ? "followers" : privacy.messages,
                    },
                    "account"
                  )
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-black capitalize transition ${
                  privacy.account === value
                    ? "bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]"
                    : "text-[#1c1d1a]/60 dark:text-neutral-400"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </SettingRow>

        <OptionRow
          icon={MessageCircle}
          title="Messages"
          subtitle="Controls who can start or receive post shares through Direct Messages."
          options={MESSAGE_OPTIONS}
          value={privacy.messages}
          onChange={(messages) => updatePrivacy({ ...privacy, messages }, "messages")}
        />

        <OptionRow
          icon={AtSign}
          title="Mentions"
          subtitle="Controls who can notify you with comment mentions."
          options={INTERACTION_OPTIONS}
          value={privacy.mentions}
          onChange={(mentions) => updatePrivacy({ ...privacy, mentions }, "mentions")}
        />

        <OptionRow
          icon={MessageCircle}
          title="Comments"
          subtitle="Controls who can comment on your posts."
          options={INTERACTION_OPTIONS}
          value={privacy.comments}
          onChange={(comments) => updatePrivacy({ ...privacy, comments }, "comments")}
        />

        <SettingRow
          icon={Eye}
          title="Discoverability"
          subtitle="Allow your profile to appear in people search suggestions."
        >
          <Switch
            checked={privacy.discoverable}
            disabled={savingKey === "discoverable"}
            onClick={() => updatePrivacy({ ...privacy, discoverable: !privacy.discoverable }, "discoverable")}
          />
        </SettingRow>

        <PlannedRow icon={Tag} title="Tags" subtitle="Control who can tag you in posts." note="Not available yet" />
        <PlannedRow icon={MapPin} title="Location" subtitle="Control where your location is shared on Hivez." note="Not available yet" />
      </SettingsSection>
    </>
  );
}