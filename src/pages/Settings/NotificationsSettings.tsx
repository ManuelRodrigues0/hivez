/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/firebase/firebase";
import { enablePushNotifications } from "@/services/pushNotifications";
import { PlannedRow, SectionTitle, SettingsSection, SettingRow, Switch } from "./settingsUi";

type NotificationKey = "likes" | "comments" | "reHives" | "mentions" | "follows" | "messages";

const NOTIFICATION_LABELS: { key: NotificationKey; label: string }[] = [
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "reHives", label: "ReHives" },
  { key: "mentions", label: "Mentions" },
  { key: "follows", label: "Follow requests" },
  { key: "messages", label: "Messages" },
];

export default function NotificationsSettings() {
  const { user, profile } = useAuth();
  const [savingKey, setSavingKey] = useState("");
  const [notificationPrefs, setNotificationPrefs] = useState<Record<NotificationKey, boolean>>({
    likes: true,
    comments: true,
    reHives: true,
    mentions: true,
    follows: true,
    messages: true,
  });

  useEffect(() => {
    setNotificationPrefs((current) => ({
      ...current,
      ...((profile?.notificationPreferences || {}) as Partial<Record<NotificationKey, boolean>>),
    }));
  }, [profile]);

  async function handleEnableNotifications() {
    if (!user) return;
    setSavingKey("push");
    try {
      await enablePushNotifications(user.uid);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not enable notifications.";
      console.error(message);
    } finally {
      setSavingKey("");
    }
  }

  async function updateNotificationPreference(key: NotificationKey, value: boolean) {
    if (!user) return;
    setNotificationPrefs((current) => ({ ...current, [key]: value }));
    setSavingKey(`notification-${key}`);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { notificationPreferences: { [key]: value } },
        { merge: true }
      );
    } finally {
      setSavingKey("");
    }
  }

  return (
    <>
      <SectionTitle title="In-app" />
      <SettingsSection>
        <SettingRow icon={Bell} title="In-app notifications" subtitle="Alert channels Hivez creates for your account.">
          <span className="rounded-full bg-[#3d654c]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#3d654c] dark:bg-[#f2c14e]/15 dark:text-[#f2c14e]">
            On
          </span>
        </SettingRow>
        {NOTIFICATION_LABELS.map((item) => (
          <SettingRow
            key={item.key}
            icon={Bell}
            title={item.label}
            subtitle="Controls whether Hivez creates this alert for your account."
          >
            <Switch
              checked={notificationPrefs[item.key] !== false}
              disabled={savingKey === `notification-${item.key}`}
              onClick={() => updateNotificationPreference(item.key, notificationPrefs[item.key] === false)}
            />
          </SettingRow>
        ))}
      </SettingsSection>

      <SectionTitle title="Delivery channels" />
      <SettingsSection>
        <SettingRow icon={Bell} title="Push notifications" subtitle="Enable device alerts for Hivez activity.">
          <button
            type="button"
            onClick={() => void handleEnableNotifications()}
            disabled={savingKey === "push"}
            className="rounded-xl bg-[#3d654c] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#32533e] disabled:opacity-50 dark:bg-[#f2c14e] dark:text-[#121212]"
          >
            {savingKey === "push" ? "Enabling..." : "Enable"}
          </button>
        </SettingRow>
        <PlannedRow icon={Bell} title="Email notifications" subtitle="Receive activity digests by email." note="Coming soon" />
        <PlannedRow icon={Bell} title="SMS notifications" subtitle="Receive important alerts by text message." note="Coming soon" />
      </SettingsSection>
    </>
  );
}