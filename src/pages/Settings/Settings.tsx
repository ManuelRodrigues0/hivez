/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  AtSign,
  Bell,
  ChevronRight,
  Eye,
  Lock,
  LogOut,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  User,
} from "lucide-react";
import { doc, setDoc } from "firebase/firestore";

import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { logout } from "../../services/auth";
import { enablePushNotifications } from "@/services/pushNotifications";
import { db } from "@/firebase/firebase";
import {
  normalizePrivacy,
  saveUserPrivacySettings,
  type InteractionPrivacy,
  type MessagePrivacy,
  type UserPrivacySettings,
} from "@/services/privacy";

type NotificationKey = "likes" | "comments" | "reHives" | "mentions" | "follows" | "messages";

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

const NOTIFICATION_LABELS: { key: NotificationKey; label: string }[] = [
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "reHives", label: "ReHives" },
  { key: "mentions", label: "Mentions" },
  { key: "follows", label: "Follow requests" },
  { key: "messages", label: "Messages" },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [privacy, setPrivacy] = useState<UserPrivacySettings>(() => normalizePrivacy(profile));
  const [notificationPrefs, setNotificationPrefs] = useState<Record<NotificationKey, boolean>>({
    likes: true,
    comments: true,
    reHives: true,
    mentions: true,
    follows: true,
    messages: true,
  });

  useEffect(() => {
    setPrivacy(normalizePrivacy(profile));
    setNotificationPrefs((current) => ({
      ...current,
      ...((profile?.notificationPreferences || {}) as Partial<Record<NotificationKey, boolean>>),
    }));
  }, [profile]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
    }
  }

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

  async function updateNotificationPreference(key: NotificationKey, value: boolean) {
    if (!user) return;
    setNotificationPrefs((current) => ({ ...current, [key]: value }));
    setSavingKey(`notification-${key}`);
    try {
      await setDoc(doc(db, "users", user.uid), { notificationPreferences: { [key]: value } }, { merge: true });
    } finally {
      setSavingKey("");
    }
  }

  return (
    <div className="w-full min-h-screen px-4 py-5 md:px-8 space-y-6 select-none">
      <div className="flex items-center justify-between pb-3 border-b border-[#1c1d1a]/10 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-white text-[#1c1d1a] shadow-2xs transition hover:bg-[#ecece5] dark:border-neutral-800 dark:bg-[#141414] dark:text-white dark:hover:bg-neutral-800"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-[#1c1d1a] dark:text-white">Settings</h1>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#3d654c] dark:text-[#f2c14e]">
              Account, Privacy & Alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-[#3d654c]/20 bg-[#3d654c]/10 px-3 py-1 text-[11px] font-bold text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
          <ShieldCheck size={14} />
          <span>{privacy.account === "private" ? "Private" : "Public"}</span>
        </div>
      </div>

      <section className="w-full rounded-2xl border border-[#1c1d1a]/10 bg-white p-4 shadow-xs dark:border-neutral-800/90 dark:bg-[#121212] md:p-5">
        <button onClick={() => navigate("/profile/edit")} className="flex w-full items-center gap-4 text-left">
          <div className="relative shrink-0">
            <img
              src={profile?.photoURL || user?.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=3d654c&color=fff"}
              alt=""
              className="h-14 w-14 rounded-2xl border-2 border-[#3d654c]/20 object-cover shadow-xs dark:border-[#f2c14e]/20"
            />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]">
              <Sparkles size={9} />
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-black text-[#1c1d1a] dark:text-white">
              {profile?.displayName || user?.displayName || "Hivez Contributor"}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-[#1c1d1a]/60 dark:text-neutral-400">
              @{profile?.username || user?.email?.split("@")[0] || "user"}
            </p>
          </div>
          <ChevronRight size={17} className="text-[#1c1d1a]/35 dark:text-neutral-500" />
        </button>
      </section>

      <SectionTitle title="Privacy" />
      <section className="rounded-2xl border border-[#1c1d1a]/10 bg-white p-4 shadow-xs dark:border-neutral-800/90 dark:bg-[#121212]">
        <SettingRow icon={Lock} title="Account Privacy" subtitle="Private accounts require approval before protected posts and ReHives are visible.">
          <div className="grid w-full max-w-[220px] grid-cols-2 rounded-xl bg-[#f7f7f2] p-1 dark:bg-[#1a1a1a]">
            {(["public", "private"] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={savingKey === "account"}
                onClick={() => updatePrivacy({ ...privacy, account: value, messages: value === "private" && privacy.messages === "everyone" ? "followers" : privacy.messages }, "account")}
                className={`rounded-lg px-3 py-1.5 text-xs font-black capitalize transition ${
                  privacy.account === value ? "bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]" : "text-[#1c1d1a]/60 dark:text-neutral-400"
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

        <SettingRow icon={Eye} title="Search & Explore" subtitle="Allow your profile to appear in people search suggestions.">
          <Switch
            checked={privacy.discoverable}
            disabled={savingKey === "discoverable"}
            onClick={() => updatePrivacy({ ...privacy, discoverable: !privacy.discoverable }, "discoverable")}
          />
        </SettingRow>
      </section>

      <SectionTitle title="Notifications" />
      <section className="rounded-2xl border border-[#1c1d1a]/10 bg-white p-4 shadow-xs dark:border-neutral-800/90 dark:bg-[#121212]">
        <SettingRow icon={Bell} title="Push Notifications" subtitle="Enable device alerts for Hivez activity.">
          <button
            type="button"
            onClick={handleEnableNotifications}
            disabled={savingKey === "push"}
            className="rounded-xl bg-[#3d654c] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#32533e] disabled:opacity-50 dark:bg-[#f2c14e] dark:text-[#121212]"
          >
            Enable
          </button>
        </SettingRow>

        {NOTIFICATION_LABELS.map((item) => (
          <SettingRow key={item.key} icon={Bell} title={item.label} subtitle="Controls whether Hivez creates this alert for your account.">
            <Switch
              checked={notificationPrefs[item.key] !== false}
              disabled={savingKey === `notification-${item.key}`}
              onClick={() => updateNotificationPreference(item.key, notificationPrefs[item.key] === false)}
            />
          </SettingRow>
        ))}
      </section>

      <SectionTitle title="Appearance" />
      <section className="rounded-2xl border border-[#1c1d1a]/10 bg-white p-4 shadow-xs dark:border-neutral-800/90 dark:bg-[#121212]">
        <SettingRow icon={theme === "dark" ? Moon : Sun} title={theme === "dark" ? "Dark Mode" : "Light Mode"} subtitle="Switch Hivez between light and dark appearance.">
          <Switch checked={theme === "dark"} onClick={toggleTheme} />
        </SettingRow>
      </section>

      <div className="w-full pb-10 pt-2">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3.5 text-xs font-bold text-rose-700 shadow-xs transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          <LogOut size={16} />
          <span>{loggingOut ? "Logging out..." : "Sign Out from Hivez"}</span>
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#1c1d1a]/45 dark:text-neutral-500">
      {title}
    </h2>
  );
}

function SettingRow({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof User;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#1c1d1a]/5 py-3.5 last:border-b-0 dark:border-neutral-800/60 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-[#f2c14e]">
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">{title}</p>
          <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#1c1d1a]/55 dark:text-neutral-400">{subtitle}</p>
        </div>
      </div>
      <div className="sm:shrink-0">{children}</div>
    </div>
  );
}

function OptionRow<T extends string>({
  icon,
  title,
  subtitle,
  options,
  value,
  onChange,
}: {
  icon: typeof User;
  title: string;
  subtitle: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <SettingRow icon={icon} title={title} subtitle={subtitle}>
      <div className="grid min-w-[240px] grid-cols-2 gap-1 rounded-xl bg-[#f7f7f2] p-1 dark:bg-[#1a1a1a] sm:grid-cols-4">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-2 py-1.5 text-[11px] font-black transition ${
              value === option.value ? "bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]" : "text-[#1c1d1a]/60 dark:text-neutral-400"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </SettingRow>
  );
}

function Switch({
  checked,
  disabled,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${
        checked ? "bg-[#3d654c] dark:bg-[#f2c14e]" : "bg-neutral-200 dark:bg-neutral-800"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 dark:bg-[#121212] ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
