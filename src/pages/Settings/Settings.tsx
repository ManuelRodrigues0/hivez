// HIVEZ — SETTINGS · canonical page layer (ONE FILE, MANY COMPONENTS)
// Drill-down model, NO persistent sidebar:
//   /settings                 → Settings (hub)
//   /settings (layout)        → SettingsLayout (wraps sub-routes via <Outlet/>)
//   /settings/account         → AccountSettings
//   /settings/privacy         → PrivacySettings
//   /settings/security        → SecuritySettings
//   /settings/notifications   → NotificationsSettings
//   /settings/content         → ContentPreferencesSettings
//   /settings/appearance      → AppearanceSettings
//   /settings/accessibility   → AccessibilitySettings
//   /settings/language        → LanguageSettings
//   /settings/data            → DataSettings
//   /settings/delete          → DeleteAccountSettings
// Consolidated verbatim from 14 former page files. Behavior, state, listeners,
// styling and routes unchanged — structural merge only.

// ============================================================
// IMPORTS
// ============================================================

import { doc, getDoc, getDocs, collection, query, where, setDoc } from "firebase/firestore";
import {
  Accessibility,
  Activity,
  AlertTriangle,
  ArrowLeft,
  AtSign,
  Bell,
  Bookmark,
  CalendarDays,
  ChevronRight,
  Contrast,
  Database,
  Download,
  Eye,
  Fingerprint,
  KeyRound,
  Languages,
  Laptop,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  Type,
  User,
  type LucideIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import gsap from "gsap";
import { useAuth } from "@/context/AuthContext.tsx";
import { useTheme } from "@/context/ThemeContext.tsx";
import { db } from "@/firebase/firebase.ts";
import { logout } from "@/services/auth.ts";
import { enablePushNotifications } from "@/services/pushNotifications.ts";
import {
  normalizePrivacy,
  saveSensitiveContentPreference,
  saveUserPrivacySettings,
  sensitiveContentPreference,
  type InteractionPrivacy,
  type MessagePrivacy,
  type SensitiveContentPreference,
  type UserPrivacySettings,
} from "@/services/privacy.ts";
import { reauthenticateWithCredential, EmailAuthProvider, updateEmail, updatePassword } from "firebase/auth";

// ============================================================
// LOCAL CONFIG — SETTINGS NAV MODEL   (consolidated from settingsNav.tsx)
// ============================================================

export interface SettingsCategory {
  key: string;
  label: string;
  description: string;
  path: string;
  icon: LucideIcon;
  /** Top-level section on the /settings hub that owns this category. */
  group: string;
  /** Categories that live at a dedicated route outside /settings/*. */
  external?: boolean;
}

export interface SettingsGroup {
  key: string;
  label: string;
}

/** Ordered top-level sections rendered on the /settings hub. */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  { key: "account", label: "Account" },
  { key: "privacy-safety", label: "Privacy & safety" },
  { key: "communication", label: "Communication" },
  { key: "content", label: "Content" },
  { key: "appearance-accessibility", label: "Appearance & accessibility" },
  { key: "data", label: "Data" },
  { key: "danger-zone", label: "Danger zone" },
];

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { key: "account", label: "Account", description: "Personal info, username, email, join date, account status", path: "/settings/account", icon: User, group: "account" },
  { key: "privacy", label: "Privacy", description: "Account privacy, messages, mentions, comments, discoverability", path: "/settings/privacy", icon: Lock, group: "privacy-safety" },
  { key: "security", label: "Security", description: "Two-factor authentication, passkeys, login activity, devices", path: "/settings/security", icon: Shield, group: "privacy-safety" },
  { key: "notifications", label: "Notifications", description: "Push, in-app and per-activity alert preferences", path: "/settings/notifications", icon: Bell, group: "communication" },
  { key: "content", label: "Content preferences", description: "Sensitive content, languages, topics and interests", path: "/settings/content", icon: Eye, group: "content" },
  { key: "appearance", label: "Appearance", description: "Light and dark theme, font size, animations", path: "/settings/appearance", icon: Moon, group: "appearance-accessibility" },
  { key: "accessibility", label: "Accessibility", description: "Reduced motion and reading preferences", path: "/settings/accessibility", icon: Accessibility, group: "appearance-accessibility" },
  { key: "language", label: "Language", description: "Display language for Hivez", path: "/settings/language", icon: Languages, group: "appearance-accessibility" },
  { key: "data", label: "Data", description: "Download, usage and on-device cache", path: "/settings/data", icon: Database, group: "data" },
  { key: "saved", label: "Saved posts", description: "Posts you have bookmarked — private to you", path: "/settings/saved", icon: Bookmark, group: "data", external: true },
  { key: "activity", label: "Your activity", description: "Alerts and interactions across your account", path: "/settings/activity", icon: Activity, group: "data", external: true },
  { key: "delete", label: "Delete / deactivate", description: "Temporarily or permanently close your account", path: "/settings/delete", icon: Trash2, group: "danger-zone" },
];
// ============================================================
// SHARED PAGE HELPERS — SETTINGS UI PRIMITIVES   (consolidated from settingsUi.tsx)
// ============================================================

export function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="px-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#3d654c]/70 dark:text-[#f2c14e]/80">
      {title}
    </h2>
  );
}

export function SettingsSection({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-[#1c1d1a]/10 bg-white/80 p-2 shadow-sm backdrop-blur-xl dark:border-neutral-800/90 dark:bg-[#161616]/80">
      {children}
    </section>
  );
}

export function SettingRow({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl p-3 transition hover:bg-[#f7f7f2]/80 dark:hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] shadow-xs dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#1c1d1a] dark:text-white">{title}</p>
          <p className="mt-0.5 text-xs font-medium leading-relaxed text-[#1c1d1a]/60 dark:text-neutral-400">{subtitle}</p>
        </div>
      </div>
      <div className="sm:shrink-0">{children}</div>
    </div>
  );
}

export function OptionRow<T extends string>({
  icon,
  title,
  subtitle,
  options,
  value,
  onChange,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <SettingRow icon={icon} title={title} subtitle={subtitle}>
      <div className="grid min-w-[240px] grid-cols-2 gap-1.5 rounded-2xl bg-[#f7f7f2] p-1.5 dark:bg-[#1a1a1a] sm:grid-cols-4">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-xl px-3 py-2 text-xs font-black transition-all duration-200 ${
              value === option.value
                ? "bg-[#3d654c] text-white shadow-md dark:bg-[#f2c14e] dark:text-[#121212]"
                : "text-[#1c1d1a]/60 hover:text-[#1c1d1a] dark:text-neutral-400 dark:hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </SettingRow>
  );
}

export function Switch({
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
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 disabled:opacity-50 shadow-inner ${
        checked ? "bg-[#3d654c] dark:bg-[#f2c14e]" : "bg-neutral-200 dark:bg-neutral-800"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 dark:bg-[#121212] ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export function PlannedRow({
  icon: Icon,
  title,
  subtitle,
  note = "Unavailable",
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  note?: string;
}) {
  return (
    <SettingRow icon={Icon} title={title} subtitle={subtitle}>
      <span className="inline-flex items-center rounded-full bg-[#1c1d1a]/5 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#1c1d1a]/45 dark:bg-white/10 dark:text-neutral-400">
        {note}
      </span>
    </SettingRow>
  );
}

export function NavRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3.5 rounded-2xl p-3 text-left transition-all duration-200 hover:bg-[#f7f7f2] focus-visible:ring-2 focus-visible:ring-[#3d654c]/40 dark:hover:bg-white/5"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] shadow-xs transition group-hover:scale-105 dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#1c1d1a] dark:text-white group-hover:text-[#3d654c] dark:group-hover:text-[#f2c14e] transition-colors">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1c1d1a]/5 text-[#1c1d1a]/40 transition group-hover:translate-x-0.5 group-hover:bg-[#3d654c] group-hover:text-white dark:bg-white/5 dark:text-neutral-400 dark:group-hover:bg-[#f2c14e] dark:group-hover:text-[#121212]">
        <ChevronRight size={16} />
      </div>
    </button>
  );
}
// ============================================================
// SETTINGS LAYOUT   (consolidated from SettingsLayout.tsx)
// ============================================================

/**
 * Settings layout (strict drill-down):
 *  - /settings renders ONLY the top-level category list (Settings hub).
 *  - A category route renders ONLY that category — the parent list is fully
 *    replaced, never shown beside it, on desktop and mobile alike.
 *  - Navigation is route-based, so browser Back/Forward, refresh and deep
 *    links all work; the in-page back button mirrors browser Back to /settings.
 */
function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isRoot = location.pathname === "/settings";
  const containerRef = useRef<HTMLDivElement>(null);

  // Cinematic GSAP Entrance for Layout
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
      );
    }, containerRef);
    return () => ctx.revert();
  }, [location.pathname]);

  const activeCategory = [...SETTINGS_CATEGORIES]
    .reverse()
    .find(
      (cat) =>
        !cat.external &&
        (location.pathname === cat.path || location.pathname.startsWith(`${cat.path}/`))
    );

  return (
    <div ref={containerRef} className="app-settings-page w-full min-h-screen select-none px-4 sm:px-6 py-6 max-w-5xl mx-auto">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[#1c1d1a]/10 dark:border-neutral-800/80 pb-6">
        <div className="flex items-center gap-3.5">
          {!isRoot && (
            <button
              type="button"
              onClick={() => navigate("/settings")}
              aria-label="Back to settings"
              className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#1c1d1a]/10 bg-white text-[#1c1d1a] shadow-xs transition hover:bg-[#3d654c] hover:text-white hover:border-[#3d654c] focus-visible:ring-2 focus-visible:ring-[#3d654c]/40 dark:border-neutral-800 dark:bg-[#161616] dark:text-white dark:hover:bg-[#f2c14e] dark:hover:text-[#121212]"
            >
              <ArrowLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#1c1d1a] dark:text-white">
              {isRoot ? "Settings" : (activeCategory?.label || "Settings")}
            </h1>
            <p className="mt-1 text-xs font-medium text-[#1c1d1a]/60 dark:text-neutral-400">
              {isRoot
                ? "Manage your account, privacy and Hivez preferences"
                : (activeCategory?.description || "Manage your Hivez preferences")}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full space-y-6 pb-16">
        <Outlet />
      </div>
    </div>
  );
}
// ============================================================
// SETTINGS HUB   (consolidated from Settings.tsx)
// ============================================================

/**
 * Settings hub (/settings). Shows a compact account summary card, the top-level
 * categories grouped under small section labels, and sign-out — the entry
 * point into every dedicated settings view.
 */
function Settings() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const privacy = normalizePrivacy(profile);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="w-full">
        <SectionTitle title="Profile" />
        <div className="mt-2.5">
          <SettingsSection>
            <button
              type="button"
              onClick={() => navigate("/profile/edit")}
              className="group flex w-full items-center gap-4 rounded-2xl p-3 text-left transition-all duration-300 hover:bg-[#f7f7f2] focus-visible:ring-2 focus-visible:ring-[#3d654c]/40 dark:hover:bg-white/5"
            >
              <div className="relative shrink-0">
                <img
                  src={profile?.photoURL || user?.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=3d654c&color=fff"}
                  alt=""
                  className="h-12 w-12 rounded-full border-2 border-[#3d654c]/30 object-cover shadow-sm transition group-hover:scale-105 dark:border-[#f2c14e]/30"
                />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#3d654c] text-white shadow-xs dark:bg-[#f2c14e] dark:text-[#121212]">
                  <Sparkles size={9} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-[#1c1d1a] dark:text-white">
                  {profile?.displayName || user?.displayName || "Hivez Contributor"}
                </p>
                <p className="truncate text-xs font-semibold text-[#1c1d1a]/60 dark:text-neutral-400">
                  @{profile?.username || user?.email?.split("@")[0] || "user"}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[#3d654c]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#3d654c] dark:bg-[#f2c14e]/15 dark:text-[#f2c14e]">
                {privacy.account === "private" ? "Private" : "Public"}
              </span>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1c1d1a]/5 text-[#1c1d1a]/40 transition group-hover:translate-x-0.5 group-hover:bg-[#3d654c] group-hover:text-white dark:bg-white/5 dark:text-neutral-400 dark:group-hover:bg-[#f2c14e] dark:group-hover:text-[#121212]">
                <ChevronRight size={16} />
              </div>
            </button>
          </SettingsSection>
        </div>
      </section>

      {SETTINGS_GROUPS.map((group) => {
        const categories = SETTINGS_CATEGORIES.filter((cat) => cat.group === group.key);
        if (!categories.length) return null;
        return (
          <section key={group.key} className="w-full">
            <SectionTitle title={group.label} />
            <div className="mt-2.5">
              <SettingsSection>
                {categories.map((cat) => (
                  <NavRow
                    key={cat.key}
                    icon={cat.icon}
                    title={cat.label}
                    subtitle={cat.description}
                    onClick={() => navigate(cat.path)}
                  />
                ))}
              </SettingsSection>
            </div>
          </section>
        );
      })}

      <div className="w-full pt-4">
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-4 text-xs font-black uppercase tracking-wider text-rose-700 shadow-xs transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          <LogOut size={16} />
          <span>{loggingOut ? "Logging out..." : "Sign Out from Hivez"}</span>
        </button>
      </div>
    </div>
  );
}
// ============================================================
// ACCOUNT   (consolidated from AccountSettings.tsx)
// ============================================================

/* eslint-disable react-hooks/set-state-in-effect */


function AccountSettings() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [privacy, setPrivacy] = useState<UserPrivacySettings>(() => normalizePrivacy(profile));
  const [savingKey, setSavingKey] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [emailForm, setEmailForm] = useState({ newEmail: "", password: "" });
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const isPasswordProvider = user?.providerData?.some((p) => p.providerId === "password") ?? false;

  useEffect(() => {
    setPrivacy(normalizePrivacy(profile));
  }, [profile]);

  async function updateAccount(next: UserPrivacySettings) {
    if (!user) return;
    setPrivacy(next);
    setSavingKey("account-privacy");
    try {
      await saveUserPrivacySettings(user.uid, next);
    } finally {
      setSavingKey("");
    }
  }

  async function handleEmailChange() {
    if (!user) return;
    setEmailError("");
    setEmailSuccess(false);
    const newEmail = emailForm.newEmail.trim();
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (newEmail === user.email) {
      setEmailError("New email must be different from current email.");
      return;
    }
    if (!emailForm.password) {
      setEmailError("Please enter your current password to confirm.");
      return;
    }
    setSavingKey("email");
    try {
      const credential = EmailAuthProvider.credential(user.email!, emailForm.password);
      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, newEmail);
      setEmailSuccess(true);
      setShowEmailForm(false);
      setEmailForm({ newEmail: "", password: "" });
      toast.success("Email updated successfully");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setEmailError("Incorrect password. Please try again.");
      } else if (code === "auth/email-already-in-use") {
        setEmailError("This email is already in use by another account.");
      } else if (code === "auth/requires-recent-login") {
        setEmailError("Please sign in again before changing your email.");
      } else {
        setEmailError("Could not update email. Please try again.");
      }
    } finally {
      setSavingKey("");
    }
  }

  async function handlePasswordChange() {
    if (!user) return;
    setPasswordError("");
    setPasswordSuccess(false);
    if (!passwordForm.current) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (passwordForm.next.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setSavingKey("password");
    try {
      const credential = EmailAuthProvider.credential(user.email!, passwordForm.current);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordForm.next);
      setPasswordSuccess(true);
      setShowPasswordForm(false);
      setPasswordForm({ current: "", next: "", confirm: "" });
      toast.success("Password updated successfully");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setPasswordError("Incorrect current password. Please try again.");
      } else if (code === "auth/requires-recent-login") {
        setPasswordError("Please sign in again before changing your password.");
      } else if (code === "auth/weak-password") {
        setPasswordError("Password is too weak. Use at least 6 characters.");
      } else {
        setPasswordError("Could not update password. Please try again.");
      }
    } finally {
      setSavingKey("");
    }
  }

  const joinDate = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString([], {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <SectionTitle title="Profile" />
        <SettingsSection>
          <NavRow
            icon={User}
            title="Personal information"
            subtitle="Update your display name and profile photo"
            onClick={() => navigate("/profile/edit")}
          />
          <NavRow
            icon={AtSign}
            title="Username"
            subtitle={profile?.username ? `@${profile.username}` : "Set a username"}
            onClick={() => navigate("/profile/edit")}
          />
        </SettingsSection>
      </section>

      <section className="space-y-2.5">
        <SectionTitle title="Contact & credentials" />
        <SettingsSection>
          <div className="w-full">
            <div className="flex w-full items-center gap-3.5 rounded-2xl p-3 border-b border-[#1c1d1a]/5 last:border-b-0 dark:border-neutral-800/60">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
                <Mail size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">Email</p>
                <p className="mt-0.5 truncate text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
                  {user?.email || "-"}
                </p>
              </div>
              {isPasswordProvider && (
                <button
                  type="button"
                  onClick={() => { setShowEmailForm(!showEmailForm); setShowPasswordForm(false); setEmailError(""); }}
                  className="rounded-full bg-[#3d654c]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#3d654c] hover:bg-[#3d654c]/20 dark:bg-[#f2c14e]/15 dark:text-[#f2c14e]"
                >
                  {showEmailForm ? "Cancel" : "Change"}
                </button>
              )}
            </div>
            {showEmailForm && isPasswordProvider && (
              <div className="mt-2 space-y-2 rounded-2xl border border-[#1c1d1a]/10 bg-[#f7f7f2]/50 p-3 dark:border-neutral-800 dark:bg-[#1a1a1a]/50">
                <input type="email" placeholder="New email address" value={emailForm.newEmail} onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })} className="w-full rounded-xl border border-[#1c1d1a]/10 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-[#121212] dark:text-white" />
                <input type="password" placeholder="Current password" value={emailForm.password} onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })} className="w-full rounded-xl border border-[#1c1d1a]/10 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-[#121212] dark:text-white" />
                {emailError && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{emailError}</p>}
                <button type="button" onClick={() => void handleEmailChange()} disabled={savingKey === "email"} className="rounded-xl bg-[#3d654c] px-4 py-2 text-xs font-bold text-white hover:bg-[#32533e] disabled:opacity-50 dark:bg-[#f2c14e] dark:text-[#121212]">
                  {savingKey === "email" ? "Updating..." : "Update email"}
                </button>
              </div>
            )}
            {emailSuccess && <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">Email updated successfully.</p>}
            {!isPasswordProvider && <p className="mt-1 px-3 text-[10px] font-medium text-[#1c1d1a]/40 dark:text-neutral-500">Email is managed by your social sign-in provider.</p>}
          </div>
          <div className="flex w-full items-center gap-3.5 rounded-2xl p-3 border-b border-[#1c1d1a]/5 last:border-b-0 dark:border-neutral-800/60">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              <Phone size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">Phone</p>
              <p className="mt-0.5 truncate text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
                {user?.phoneNumber || "Not linked"}
              </p>
            </div>
            <span className="rounded-full bg-[#1c1d1a]/5 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#1c1d1a]/45 dark:bg-white/10 dark:text-neutral-400">
              {user?.phoneNumber ? "Linked" : "Coming soon"}
            </span>
          </div>
          <div className="w-full">
            <div className="flex w-full items-center gap-3.5 rounded-2xl p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
                <KeyRound size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">Password</p>
                <p className="mt-0.5 text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
                  {isPasswordProvider ? "Change your account password" : "Password managed by your sign-in provider"}
                </p>
              </div>
              {isPasswordProvider ? (
                <button type="button" onClick={() => { setShowPasswordForm(!showPasswordForm); setShowEmailForm(false); setPasswordError(""); }} className="rounded-full bg-[#3d654c]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#3d654c] hover:bg-[#3d654c]/20 dark:bg-[#f2c14e]/15 dark:text-[#f2c14e]">
                  {showPasswordForm ? "Cancel" : "Change"}
                </button>
              ) : (
                <span className="rounded-full bg-[#1c1d1a]/5 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#1c1d1a]/45 dark:bg-white/10 dark:text-neutral-400">Social auth</span>
              )}
            </div>
            {showPasswordForm && isPasswordProvider && (
              <div className="mt-2 space-y-2 rounded-2xl border border-[#1c1d1a]/10 bg-[#f7f7f2]/50 p-3 dark:border-neutral-800 dark:bg-[#1a1a1a]/50">
                <input type="password" placeholder="Current password" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} className="w-full rounded-xl border border-[#1c1d1a]/10 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-[#121212] dark:text-white" />
                <input type="password" placeholder="New password (min 6 chars)" value={passwordForm.next} onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })} className="w-full rounded-xl border border-[#1c1d1a]/10 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-[#121212] dark:text-white" />
                <input type="password" placeholder="Confirm new password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} className="w-full rounded-xl border border-[#1c1d1a]/10 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-[#121212] dark:text-white" />
                {passwordError && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{passwordError}</p>}
                <button type="button" onClick={() => void handlePasswordChange()} disabled={savingKey === "password"} className="rounded-xl bg-[#3d654c] px-4 py-2 text-xs font-bold text-white hover:bg-[#32533e] disabled:opacity-50 dark:bg-[#f2c14e] dark:text-[#121212]">
                  {savingKey === "password" ? "Updating..." : "Update password"}
                </button>
              </div>
            )}
            {passwordSuccess && <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">Password updated successfully.</p>}
          </div>
        </SettingsSection>
      </section>

      <section className="space-y-2.5">
        <SectionTitle title="Account status" />
        <SettingsSection>
          <div className="flex w-full items-center gap-3.5 rounded-2xl p-3 border-b border-[#1c1d1a]/5 last:border-b-0 dark:border-neutral-800/60">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">Account status</p>
              <p className="mt-0.5 text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
                Your Hivez account is healthy and active.
              </p>
            </div>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Active
            </span>
          </div>
          <div className="flex w-full items-center gap-3.5 rounded-2xl p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              <CalendarDays size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">Join date</p>
              <p className="mt-0.5 text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
                {joinDate}
              </p>
            </div>
          </div>
        </SettingsSection>
      </section>

      <section className="space-y-2.5">
        <SectionTitle title="Account privacy" />
        <SettingsSection>
          <div className="flex w-full flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
                <Lock size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">Public / Private account</p>
                <p className="mt-0.5 text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
                  Private accounts require approval before protected posts and ReHives are visible.
                </p>
              </div>
            </div>
            <div className="grid w-full max-w-[220px] shrink-0 grid-cols-2 rounded-xl bg-[#f7f7f2] p-1.5 dark:bg-[#1a1a1a]">
              {(["public", "private"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={savingKey === "account-privacy"}
                  onClick={() =>
                    updateAccount({
                      ...privacy,
                      account: value,
                      messages:
                        value === "private" && privacy.messages === "everyone" ? "followers" : privacy.messages,
                    })
                  }
                  className={`rounded-lg px-3 py-2 text-xs font-black capitalize transition-all ${
                    privacy.account === value
                      ? "bg-[#3d654c] text-white shadow-sm dark:bg-[#f2c14e] dark:text-[#121212]"
                      : "text-[#1c1d1a]/60 dark:text-neutral-400"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
        </SettingsSection>
      </section>
    </div>
  );
}

// ============================================================
// PRIVACY   (consolidated from PrivacySettings.tsx)
// ============================================================

/* eslint-disable react-hooks/set-state-in-effect */


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

function PrivacySettings() {
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
    <div className="space-y-6">
      <section className="space-y-2.5">
        <SectionTitle title="Privacy" />
        <SettingsSection>
          <SettingRow
            icon={Lock}
            title="Account privacy"
            subtitle="Private accounts require approval before protected posts and ReHives are visible."
          >
            <div className="grid w-full max-w-[220px] grid-cols-2 rounded-xl bg-[#f7f7f2] p-1.5 dark:bg-[#1a1a1a]">
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
                  className={`rounded-lg px-3 py-2 text-xs font-black capitalize transition-all ${
                    privacy.account === value
                      ? "bg-[#3d654c] text-white shadow-sm dark:bg-[#f2c14e] dark:text-[#121212]"
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

          <OptionRow
            icon={Tag}
            title="Tags"
            subtitle="Controls who can tag you in posts and comments."
            options={INTERACTION_OPTIONS}
            value={privacy.mentions}
            onChange={(tags) => updatePrivacy({ ...privacy, mentions: tags }, "tags")}
          />
          <SettingRow
            icon={MapPin}
            title="Location sharing"
            subtitle="Control whether your posts can include location data."
          >
            <span className="inline-flex items-center rounded-full bg-[#3d654c]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#3d654c] dark:bg-[#f2c14e]/15 dark:text-[#f2c14e]">
              Off by default
            </span>
          </SettingRow>
        </SettingsSection>
      </section>
    </div>
  );
}
// ============================================================
// SECURITY   (consolidated from SecuritySettings.tsx)
// ============================================================

/**
 * Security section. Hivez relies on Firebase Auth for identity. The richer
 * account-security features require server-side infrastructure (Firebase Auth
 * MFA enrollment, WebAuthn challenge generation, auth event cloud functions)
 * that is not available in the current client-only architecture. They are
 * honestly documented below instead of being faked.
 */
function SecuritySettings() {
  const { user } = useAuth();
  const isPasswordProvider = user?.providerData?.some((p) => p.providerId === "password") ?? false;

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <SectionTitle title="Security" />
        <SettingsSection>
          <div className="flex w-full items-center gap-3.5 rounded-2xl p-3 border-b border-[#1c1d1a]/5 last:border-b-0 dark:border-neutral-800/60">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              <Shield size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">Sign-in method</p>
              <p className="mt-0.5 text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
                {isPasswordProvider ? "Email and password" : "Google social sign-in"}
              </p>
            </div>
            <span className="rounded-full bg-[#3d654c]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#3d654c] dark:bg-[#f2c14e]/15 dark:text-[#f2c14e]">
              Active
            </span>
          </div>
          <div className="flex w-full items-center gap-3.5 rounded-2xl p-3 border-b border-[#1c1d1a]/5 last:border-b-0 dark:border-neutral-800/60">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              <Lock size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">Two-factor authentication</p>
              <p className="mt-0.5 text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
                Requires Firebase Auth MFA enrollment (server-side). Not available in client-only mode.
              </p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Server required
            </span>
          </div>
          <div className="flex w-full items-center gap-3.5 rounded-2xl p-3 border-b border-[#1c1d1a]/5 last:border-b-0 dark:border-neutral-800/60">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              <Fingerprint size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">Passkeys</p>
              <p className="mt-0.5 text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
                Requires WebAuthn server-side challenge generation. Not available in client-only mode.
              </p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Server required
            </span>
          </div>
          <div className="flex w-full items-center gap-3.5 rounded-2xl p-3 border-b border-[#1c1d1a]/5 last:border-b-0 dark:border-neutral-800/60">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              <Laptop size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">Devices</p>
              <p className="mt-0.5 text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
                Firebase Auth does not expose session management from the client. Requires a cloud function backend.
              </p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Server required
            </span>
          </div>
          <div className="flex w-full items-center gap-3.5 rounded-2xl p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">Login activity</p>
              <p className="mt-0.5 text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
                Requires auth event cloud functions to record sign-ins. Not available in client-only mode.
              </p>
            </div>
            <span className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Server required
            </span>
          </div>
        </SettingsSection>
      </section>
    </div>
  );
}
// ============================================================
// NOTIFICATIONS   (consolidated from NotificationsSettings.tsx)
// ============================================================

/* eslint-disable react-hooks/set-state-in-effect */


type NotificationKey = "likes" | "comments" | "reHives" | "mentions" | "follows" | "messages";

const NOTIFICATION_LABELS: { key: NotificationKey; label: string }[] = [
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "reHives", label: "ReHives" },
  { key: "mentions", label: "Mentions" },
  { key: "follows", label: "Follow requests" },
  { key: "messages", label: "Messages" },
];

function NotificationsSettings() {
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
    <div className="space-y-6">
      <section className="space-y-2.5">
        <SectionTitle title="In-app" />
        <SettingsSection>
          <SettingRow icon={Bell} title="In-app notifications" subtitle="Alert channels Hivez creates for your account.">
            <span className="inline-flex items-center rounded-full bg-[#3d654c]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#3d654c] dark:bg-[#f2c14e]/15 dark:text-[#f2c14e]">
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
      </section>

      <section className="space-y-2.5">
        <SectionTitle title="Delivery channels" />
        <SettingsSection>
          <SettingRow icon={Bell} title="Push notifications" subtitle="Enable device alerts for Hivez activity.">
            <button
              type="button"
              onClick={() => void handleEnableNotifications()}
              disabled={savingKey === "push"}
              className="rounded-xl bg-[#3d654c] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#32533e] disabled:opacity-50 dark:bg-[#f2c14e] dark:text-[#121212]"
            >
              {savingKey === "push" ? "Enabling..." : "Enable"}
            </button>
          </SettingRow>
          <PlannedRow icon={Bell} title="Email notifications" subtitle="Receive activity digests by email." note="Coming soon" />
          <PlannedRow icon={Bell} title="SMS notifications" subtitle="Receive important alerts by text message." note="Coming soon" />
        </SettingsSection>
      </section>
    </div>
  );
}
// ============================================================
// CONTENT PREFERENCES   (consolidated from ContentPreferencesSettings.tsx)
// ============================================================

function ContentPreferencesSettings() {
  const { user, profile } = useAuth();
  const [contentPref, setContentPref] = useState<SensitiveContentPreference>(() =>
    sensitiveContentPreference(profile)
  );
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    const prefs = profile?.preferences as Record<string, unknown> | undefined;
    if (prefs?.topics && Array.isArray(prefs.topics)) setSelectedTopics(prefs.topics as string[]);
    if (prefs?.interests && Array.isArray(prefs.interests)) setSelectedInterests(prefs.interests as string[]);
  }, [profile]);

  async function updatePreference(value: SensitiveContentPreference) {
    if (!user) return;
    const previous = contentPref;
    setContentPref(value);
    try {
      await saveSensitiveContentPreference(user.uid, value);
    } catch (error) {
      console.error("Failed to save sensitive content preference:", error);
      setContentPref(previous);
    }
  }

  async function savePreference(key: string, value: string[]) {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), { preferences: { [key]: value } }, { merge: true });
      toast.success("Preferences saved");
    } catch (error) {
      console.error("Failed to save preference:", error);
      toast.error("Could not save preferences.");
    }
  }

  const TOPICS = ["Environment", "Education", "Health", "Infrastructure", "Safety", "Community", "Technology", "Culture"];
  const INTERESTS = ["Volunteering", "Community Building", "Emergency Response", "Mentorship", "Fundraising", "Advocacy"];

  function toggleTopic(topic: string) {
    const next = selectedTopics.includes(topic) ? selectedTopics.filter((t) => t !== topic) : [...selectedTopics, topic];
    setSelectedTopics(next);
    void savePreference("topics", next);
  }

  function toggleInterest(interest: string) {
    const next = selectedInterests.includes(interest) ? selectedInterests.filter((i) => i !== interest) : [...selectedInterests, interest];
    setSelectedInterests(next);
    void savePreference("interests", next);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
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
      </section>

      <section className="space-y-2.5">
        <SectionTitle title="Topics" />
        <SettingsSection>
          <div className="flex flex-wrap gap-2 p-3">
            {TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => toggleTopic(topic)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                  selectedTopics.includes(topic)
                    ? "bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]"
                    : "bg-[#f7f7f2] text-[#1c1d1a]/60 hover:bg-[#3d654c]/10 dark:bg-[#1a1a1a] dark:text-neutral-400"
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </SettingsSection>
      </section>

      <section className="space-y-2.5">
        <SectionTitle title="Interests" />
        <SettingsSection>
          <div className="flex flex-wrap gap-2 p-3">
            {INTERESTS.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                  selectedInterests.includes(interest)
                    ? "bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]"
                    : "bg-[#f7f7f2] text-[#1c1d1a]/60 hover:bg-[#3d654c]/10 dark:bg-[#1a1a1a] dark:text-neutral-400"
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </SettingsSection>
      </section>
    </div>
  );
}
// ============================================================
// APPEARANCE   (consolidated from AppearanceSettings.tsx)
// ============================================================

function AppearanceSettings() {
  const { theme, resolvedTheme, setTheme, fontSize, setFontSize, reducedMotion, setReducedMotion } = useTheme();

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <SectionTitle title="Theme" />
        <SettingsSection>
          <SettingRow
            icon={resolvedTheme === "dark" ? Moon : Sun}
            title="App theme"
            subtitle="Choose light, dark, or follow your device."
          >
            <div className="grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-[#f7f7f2] p-1.5 dark:bg-[#1a1a1a]">
              {(["light", "dark", "system"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`rounded-lg px-2 py-1.5 text-[10px] font-black uppercase transition-all ${
                    theme === t
                      ? "bg-[#3d654c] text-white shadow-sm dark:bg-[#f2c14e] dark:text-[#121212]"
                      : "text-[#1c1d1a]/60 dark:text-neutral-400"
                  }`}
                >
                  {t === "system" ? "Auto" : t === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </SettingRow>
        </SettingsSection>
      </section>

      <section className="space-y-2.5">
        <SectionTitle title="Typography & motion" />
        <SettingsSection>
          <SettingRow
            icon={Type}
            title="Font size"
            subtitle="Adjust text size across Hivez."
          >
            <div className="grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-[#f7f7f2] p-1.5 dark:bg-[#1a1a1a]">
              {(["small", "default", "large"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFontSize(s)}
                  className={`rounded-lg px-2 py-1.5 text-[10px] font-black uppercase transition-all ${
                    fontSize === s
                      ? "bg-[#3d654c] text-white shadow-sm dark:bg-[#f2c14e] dark:text-[#121212]"
                      : "text-[#1c1d1a]/60 dark:text-neutral-400"
                  }`}
                >
                  {s === "small" ? "Small" : s === "large" ? "Large" : "Default"}
                </button>
              ))}
            </div>
          </SettingRow>
          <SettingRow
            icon={Sparkles}
            title="Reduce motion"
            subtitle="Minimize animations across the interface."
          >
            <Switch
              checked={reducedMotion}
              onClick={() => setReducedMotion(!reducedMotion)}
            />
          </SettingRow>
        </SettingsSection>
      </section>
    </div>
  );
}
// ============================================================
// ACCESSIBILITY   (consolidated from AccessibilitySettings.tsx)
// ============================================================

function AccessibilitySettings() {
  const { fontSize, setFontSize, reducedMotion, setReducedMotion, highContrast, setHighContrast } = useTheme();

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <SectionTitle title="Accessibility" />
        <SettingsSection>
          <SettingRow
            icon={Accessibility}
            title="Reduce motion"
            subtitle="Minimize animations across the interface."
          >
            <Switch
              checked={reducedMotion}
              onClick={() => setReducedMotion(!reducedMotion)}
            />
          </SettingRow>
          <SettingRow
            icon={Type}
            title="Text size"
            subtitle="Adjust interface text size."
          >
            <div className="grid shrink-0 grid-cols-3 gap-1 rounded-xl bg-[#f7f7f2] p-1.5 dark:bg-[#1a1a1a]">
              {(["small", "default", "large"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFontSize(s)}
                  className={`rounded-lg px-2 py-1.5 text-[10px] font-black uppercase transition-all ${
                    fontSize === s
                      ? "bg-[#3d654c] text-white shadow-sm dark:bg-[#f2c14e] dark:text-[#121212]"
                      : "text-[#1c1d1a]/60 dark:text-neutral-400"
                  }`}
                >
                  {s === "small" ? "Small" : s === "large" ? "Large" : "Default"}
                </button>
              ))}
            </div>
          </SettingRow>
          <SettingRow
            icon={Contrast}
            title="High contrast"
            subtitle="Increase the contrast of surfaces and text."
          >
            <Switch
              checked={highContrast}
              onClick={() => setHighContrast(!highContrast)}
            />
          </SettingRow>
        </SettingsSection>
      </section>
    </div>
  );
}
// ============================================================
// LANGUAGE   (consolidated from LanguageSettings.tsx)
// ============================================================

const LANGUAGES = [
  { code: "en-US", label: "English (US)", available: true },
  { code: "hi-IN", label: "हिन्दी (Hindi)", available: false },
  { code: "ta-IN", label: "தமிழ் (Tamil)", available: false },
];

function LanguageSettings() {
  const { user, profile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [currentLang, setCurrentLang] = useState<string>(() => {
    return (profile?.preferences as Record<string, unknown> | undefined)?.language as string || "en-US";
  });

  async function handleLanguageChange(code: string) {
    if (!user || code === currentLang) return;
    setCurrentLang(code);
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), { preferences: { language: code } }, { merge: true });
      toast.success("Language preference saved");
    } catch (error) {
      console.error("Failed to save language:", error);
      toast.error("Could not save language preference.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <SectionTitle title="Language" />
        <SettingsSection>
          <div className="px-2 pb-2">
            <p className="text-xs font-medium text-[#1c1d1a]/55 dark:text-neutral-400">
              Choose your display language. Currently only English (US) is fully supported.
            </p>
          </div>
          {LANGUAGES.map((lang) => (
            <div
              key={lang.code}
              className="flex w-full items-center gap-3.5 rounded-2xl p-3 border-b border-[#1c1d1a]/5 last:border-b-0 dark:border-neutral-800/60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#3d654c]/15 bg-[#3d654c]/10 text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
                <Languages size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[#1c1d1a] dark:text-white">{lang.label}</p>
              </div>
              {lang.available ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleLanguageChange(lang.code)}
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide transition ${
                    currentLang === lang.code
                      ? "bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]"
                      : "bg-[#3d654c]/10 text-[#3d654c] hover:bg-[#3d654c]/20 dark:bg-[#f2c14e]/15 dark:text-[#f2c14e]"
                  }`}
                >
                  {currentLang === lang.code ? "Selected" : "Select"}
                </button>
              ) : (
                <span className="inline-flex items-center rounded-full bg-[#1c1d1a]/5 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#1c1d1a]/45 dark:bg-white/10 dark:text-neutral-400">
                  Soon
                </span>
              )}
            </div>
          ))}
        </SettingsSection>
      </section>
    </div>
  );
}
// ============================================================
// DATA   (consolidated from DataSettings.tsx)
// ============================================================

function DataSettings() {
  const { user } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [usage, setUsage] = useState<{ localStorage: string; estimated: string } | null>(null);

  useEffect(() => {
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) totalBytes += (localStorage.getItem(key)?.length ?? 0) * 2;
    }
    const fmt = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;
    setUsage({ localStorage: fmt(totalBytes), estimated: fmt(totalBytes) });
  }, []);

  async function handleClearCache() {
    setClearing(true);
    try {
      const keys = ["hivez-theme", "hivez-font-size", "hivez-reduced-motion", "hivez-high-contrast"];
      const saved = keys.reduce((acc, k) => { const v = localStorage.getItem(k); if (v) acc[k] = v; return acc; }, {} as Record<string, string>);
      localStorage.clear();
      Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v));
      const storage = (navigator as Navigator & { storage?: { clear?: () => Promise<void> } }).storage;
      if (storage?.clear) await storage.clear().catch(() => undefined);
      toast.success("On-device cache cleared");
    } catch (error) {
      console.error("Failed to clear cache:", error);
      toast.error("Could not clear cache. Please try again.");
    } finally {
      setClearing(false);
    }
  }

  async function handleExportData() {
    if (!user) return;
    setExporting(true);
    try {
      const followsData: { followers: unknown[]; following: unknown[] } = { followers: [], following: [] };
      const exportData: Record<string, unknown> = { exportedAt: new Date().toISOString(), profile: null, posts: [] as unknown[], comments: [] as unknown[], follows: followsData, settings: {} as Record<string, unknown> };
      const profileSnap = await getDoc(doc(db, "users", user.uid));
      if (profileSnap.exists()) {
        const p = profileSnap.data();
        exportData.profile = { displayName: p.displayName, username: p.username, bio: p.bio, photoURL: p.photoURL, verified: p.verified, followers: p.followers, following: p.following, posts: p.posts, createdAt: p.createdAt };
        exportData.settings = { privacy: p.privacy, notificationPreferences: p.notificationPreferences, preferences: p.preferences };
      }
      const postsSnap = await getDocs(query(collection(db, "posts"), where("uid", "==", user.uid)));
      exportData.posts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const commentsSnap = await getDocs(query(collection(db, "comments"), where("uid", "==", user.uid)));
      exportData.comments = commentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const followersSnap = await getDocs(collection(db, "users", user.uid, "followers"));
      const followingSnap = await getDocs(collection(db, "users", user.uid, "following"));
      followsData.followers = followersSnap.docs.map((d) => d.data());
      followsData.following = followingSnap.docs.map((d) => d.data());
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hivez-data-${user.uid}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Data export downloaded");
    } catch (error) {
      console.error("Failed to export data:", error);
      toast.error("Could not export data. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <SectionTitle title="Your data" />
        <SettingsSection>
          <SettingRow
            icon={Download}
            title="Download data"
            subtitle="Get an export of your posts, comments, profile and settings as JSON."
          >
            <button
              type="button"
              onClick={() => void handleExportData()}
              disabled={exporting}
              className="rounded-xl bg-[#3d654c]/10 px-4 py-2 text-xs font-bold text-[#3d654c] transition hover:bg-[#3d654c]/20 disabled:opacity-50 dark:bg-[#f2c14e]/15 dark:text-[#f2c14e]"
            >
              {exporting ? "Exporting..." : "Export"}
            </button>
          </SettingRow>
          <SettingRow
            icon={Database}
            title="Data usage"
            subtitle={usage ? `Local storage: ${usage.localStorage} (estimated)` : "Calculating..."}
          >
            <span className="inline-flex items-center rounded-full bg-[#1c1d1a]/5 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-[#1c1d1a]/45 dark:bg-white/10 dark:text-neutral-400">
              Local only
            </span>
          </SettingRow>
          <SettingRow
            icon={Trash2}
            title="Clear cache"
            subtitle="Clears photos, drafts and other on-device caches. Your posts and data in Firestore stay untouched."
          >
            <button
              type="button"
              onClick={() => void handleClearCache()}
              disabled={clearing}
              className="rounded-xl bg-[#1c1d1a]/5 px-4 py-2 text-xs font-bold text-[#1c1d1a] transition hover:bg-[#1c1d1a]/10 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              {clearing ? "Clearing..." : "Clear cache"}
            </button>
          </SettingRow>
        </SettingsSection>
      </section>
    </div>
  );
}
// ============================================================
// DELETE / DEACTIVATE   (consolidated from DeleteAccountSettings.tsx)
// ============================================================

function DeleteAccountSettings() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <SectionTitle title="Deactivate or delete account" />
        <SettingsSection>
          <div className="flex items-start gap-3.5 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <div className="min-w-0 space-y-1 text-xs leading-relaxed">
              <p className="font-bold">This area controls the future of your Hivez account.</p>
              <p>
                <strong>Deactivation</strong> temporarily hides your profile and posts. You can reactivate by signing back in.
              </p>
              <p>
                <strong>Deletion</strong> permanently removes your account, posts, and data. This cannot be undone.
              </p>
              <p className="text-rose-600 dark:text-rose-300">
                Full account deletion requires backend cleanup (cloud functions) that is not available in client-only mode.
                Contact Hivez support for permanent deletion.
              </p>
            </div>
          </div>

          {confirming ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Sign out and continue later?</p>
              <p className="mt-1 text-xs text-rose-700/80 dark:text-rose-400/80">
                Account deletion is not automatic. You will be signed out only; your data stays in Hivez.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setConfirming(false); }}
                  className="rounded-xl border border-[#1c1d1a]/10 bg-white px-4 py-2 text-xs font-bold text-[#1c1d1a] transition hover:bg-[#ecece5] disabled:opacity-50 dark:border-neutral-800 dark:bg-[#141414] dark:text-white dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={loggingOut}
                  className="rounded-xl bg-[#1c1d1a] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#32533e] disabled:opacity-50 dark:bg-[#f2c14e] dark:text-[#121212]"
                >
                  {loggingOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2.5 p-2">
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <LogOut size={15} />
                Deactivate account
              </button>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-4 py-3 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                <Trash2 size={15} />
                Delete account
              </button>
            </div>
          )}
        </SettingsSection>
      </section>
    </div>
  );
}
// ============================================================
// EXPORTS
// ============================================================

export {
  SettingsLayout,
  AccountSettings,
  PrivacySettings,
  SecuritySettings,
  NotificationsSettings,
  ContentPreferencesSettings,
  AppearanceSettings,
  AccessibilitySettings,
  LanguageSettings,
  DataSettings,
  DeleteAccountSettings,
};
export { Settings as SettingsHub };
export default Settings;