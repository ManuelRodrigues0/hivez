// Hivez Settings: route-based workspace; Firebase and ThemeContext remain the source of truth.
// ============================================================
// IMPORTS
// ============================================================

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  setDoc,
} from "firebase/firestore";
import {
  Accessibility,
  Activity,
  AlertTriangle,
  AtSign,
  Bell,
  Bookmark,
  CalendarDays,
  ChevronRight,
  Check,
  Search,
  X,
  SlidersHorizontal,
  ArrowUpRight,
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
import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { toast } from "sonner";
import beeStill from "@/assets/auth/newbee2.png";
import "./settings.css";
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
import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  updateEmail,
  updatePassword,
} from "firebase/auth";

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

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    key: "account",
    label: "Account",
    description: "Personal info, username, email, join date, account status",
    path: "/settings/account",
    icon: User,
    group: "account",
  },
  {
    key: "privacy",
    label: "Privacy",
    description:
      "Account privacy, messages, mentions, comments, discoverability",
    path: "/settings/privacy",
    icon: Lock,
    group: "privacy-safety",
  },
  {
    key: "security",
    label: "Security",
    description: "Two-factor authentication, passkeys, login activity, devices",
    path: "/settings/security",
    icon: Shield,
    group: "privacy-safety",
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Push, in-app and per-activity alert preferences",
    path: "/settings/notifications",
    icon: Bell,
    group: "communication",
  },
  {
    key: "content",
    label: "Content preferences",
    description: "Sensitive content, languages, topics and interests",
    path: "/settings/content",
    icon: Eye,
    group: "content",
  },
  {
    key: "appearance",
    label: "Appearance",
    description: "Light and dark theme, font size, animations",
    path: "/settings/appearance",
    icon: Moon,
    group: "appearance-accessibility",
  },
  {
    key: "accessibility",
    label: "Accessibility",
    description: "Reduced motion and reading preferences",
    path: "/settings/accessibility",
    icon: Accessibility,
    group: "appearance-accessibility",
  },
  {
    key: "language",
    label: "Language",
    description: "Display language for Hivez",
    path: "/settings/language",
    icon: Languages,
    group: "appearance-accessibility",
  },
  {
    key: "data",
    label: "Data",
    description: "Download, usage and on-device cache",
    path: "/settings/data",
    icon: Database,
    group: "data",
  },
  {
    key: "saved",
    label: "Saved posts",
    description: "Posts you have bookmarked — private to you",
    path: "/settings/saved",
    icon: Bookmark,
    group: "data",
    external: true,
  },
  {
    key: "activity",
    label: "Your activity",
    description: "Alerts and interactions across your account",
    path: "/settings/activity",
    icon: Activity,
    group: "data",
    external: true,
  },
  {
    key: "delete",
    label: "Delete / deactivate",
    description: "Temporarily or permanently close your account",
    path: "/settings/delete",
    icon: Trash2,
    group: "danger-zone",
  },
];
// ============================================================
// SHARED PAGE HELPERS — SETTINGS UI PRIMITIVES   (consolidated from settingsUi.tsx)
// ============================================================

const RowLabel = createContext<string | undefined>(undefined);

export function SectionTitle({ title }: { title: string }) {
  return <h2 className="settings-section-title">{title}</h2>;
}

export function SettingsSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`settings-panel ${className}`.trim()}>
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
  const id = useId();
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <span className="settings-row-icon">
          <Icon size={19} aria-hidden="true" />
        </span>
        <div>
          <p id={id} className="settings-row-title">
            {title}
          </p>
          <p className="settings-row-description">{subtitle}</p>
        </div>
      </div>
      <RowLabel.Provider value={id}>
        <div className="settings-row-control">{children}</div>
      </RowLabel.Provider>
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
  disabled = false,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow icon={icon} title={title} subtitle={subtitle}>
      <div className="settings-segments" role="group" aria-label={title}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
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
  const label = useContext(RowLabel);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreKeyboardFocus = useRef(false);

  useEffect(() => {
    if (!disabled && restoreKeyboardFocus.current && buttonRef.current) {
      buttonRef.current.focus();
      restoreKeyboardFocus.current = false;
    }
  }, [disabled]);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="settings-switch"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label}
      disabled={disabled}
      onClick={(event) => {
        restoreKeyboardFocus.current =
          event.detail === 0 && document.activeElement === event.currentTarget;
        onClick();
      }}
    >
      <span />
    </button>
  );
}

export function PlannedRow({
  icon,
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
    <SettingRow icon={icon} title={title} subtitle={subtitle}>
      <span className="settings-badge">{note}</span>
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
    <button type="button" onClick={onClick} className="settings-nav-row">
      <span className="settings-row-icon">
        <Icon size={19} aria-hidden="true" />
      </span>
      <span className="settings-nav-copy">
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </span>
      <ChevronRight size={17} aria-hidden="true" />
    </button>
  );
}

const NAV_GROUPS = [
  {
    label: "You & your hive",
    keys: ["account", "privacy", "security", "notifications"],
  },
  {
    label: "Make it yours",
    keys: ["content", "appearance", "accessibility", "language"],
  },
  { label: "Your records", keys: ["data", "saved", "activity", "delete"] },
];
const SEARCH_TERMS: Record<string, string> = {
  account: "profile photo name password credentials public private contact",
  privacy:
    "public private followers mutuals everyone nobody tags location sharing",
  security: "google email sign in mfa authentication",
  notifications:
    "likes comments rehives mentions follow requests messages email sms alerts",
  content:
    "show blur hide environment education health infrastructure safety community technology culture volunteering mentorship fundraising advocacy",
  appearance: "system auto light dark font text size small large reduce motion",
  accessibility: "high contrast text font size small large animations",
  language: "english hindi tamil",
  data: "export json clear storage drafts cache",
  delete: "sign out logout close account",
};
const PAGE_NOTES: Record<string, string> = {
  account: "The details that make you, you.",
  privacy: "Choose how the world connects with you.",
  security: "A little peace of mind for your account.",
  notifications: "Keep the buzz that matters.",
  content: "Make room for what interests you.",
  appearance: "A familiar place. A personal feel.",
  accessibility: "Comfort looks different for everyone.",
  language: "Feel at home in your own words.",
  data: "Your contributions. Your data. Your control.",
  delete: "Take a moment. Know your options.",
};

function SettingsLayout() {
  const location = useLocation();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousPath = useRef(location.pathname);
  const active = SETTINGS_CATEGORIES.find(
    (category) => category.path === location.pathname,
  );
  const term = search.trim().toLowerCase();
  const results = SETTINGS_CATEGORIES.filter((category) =>
    `${category.label} ${category.description} ${SEARCH_TERMS[category.key] || ""}`
      .toLowerCase()
      .includes(term),
  );
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      setSearch("");
      headingRef.current?.focus();
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  return (
    <div className="hv-settings-size"><div className="hivez-settings">
      <a className="settings-skip" href="#settings-content">
        Skip to settings content
      </a>
      <aside className="settings-sidebar">
        <Link to="/settings" className="settings-brand">
          <span>
            <SlidersHorizontal size={20} />
          </span>
          Settings
        </Link>
        <p className="settings-sidebar-caption">A little more you.</p>
        <nav aria-label="Settings categories">
          <NavLink to="/settings" end className="settings-sidebar-link">
            <SlidersHorizontal size={17} />
            Overview
          </NavLink>
          {NAV_GROUPS.map((group) => (
            <div className="settings-nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.keys.map((key) => {
                const category = SETTINGS_CATEGORIES.find(
                  (item) => item.key === key,
                )!;
                const Icon = category.icon;
                return (
                  <NavLink
                    key={key}
                    to={category.path}
                    className={`settings-sidebar-link ${key === "delete" ? "settings-danger-link" : ""}`}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{category.label}</span>
                    {category.external && (
                      <ArrowUpRight size={13} aria-hidden="true" />
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="settings-sidebar-foot">
          <span className="settings-hive-dot" />
          Made for your kind of community.
        </div>
      </aside>
      <div className="settings-workspace">
        <div className="settings-toolbar">
          <div className="settings-breadcrumb">
            <Link to="/settings">Settings</Link>
            <ChevronRight size={13} />
            <span>{active?.label || "Overview"}</span>
          </div>
          <div className="settings-search">
            <Search size={17} aria-hidden="true" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearch("");
              }}
              aria-label="Find a setting"
              placeholder="Find a setting…"
              type="search"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
              >
                <X size={15} />
              </button>
            ) : (
              <kbd>Ctrl K</kbd>
            )}
          </div>
        </div>
        <div className="settings-mobile-nav">
          <label htmlFor="settings-category">Explore settings</label>
          <SettingsMobileNavigation />
        </div>
        <div id="settings-content" className="settings-content" tabIndex={-1}>
          <header className="settings-page-heading">
            <span className="settings-eyebrow">
              {term
                ? "A quicker way there"
                : active
                  ? "Your preferences"
                  : "At home in Hivez"}
            </span>
            <h1 ref={headingRef} tabIndex={-1}>
              {term
                ? "Find your setting"
                : active?.label || "Your hive. Your way."}
            </h1>
            <p>
              {term
                ? `Results for “${search.trim()}”`
                : active
                  ? PAGE_NOTES[active.key] || active.description
                  : "Fine-tune your space, your connections, and your everyday buzz."}
            </p>
          </header>
          {term ? (
            <div className="settings-search-results">
              <p className="settings-result-count" role="status">
                {results.length}{" "}
                {results.length === 1 ? "category" : "categories"} found
              </p>
              {results.length ? (
                <SettingsSection>
                  {results.map((category) => (
                    <Link
                      className="settings-search-result"
                      key={category.key}
                      to={category.path}
                      onClick={() => setSearch("")}
                    >
                      <category.icon size={20} />
                      <span>
                        <strong>{category.label}</strong>
                        <small>{category.description}</small>
                      </span>
                      <ChevronRight size={17} />
                    </Link>
                  ))}
                </SettingsSection>
              ) : (
                <div className="settings-empty">
                  <Search size={28} />
                  <h2>No settings found</h2>
                  <p>Try “theme”, “messages”, or “text size”.</p>
                  <button
                    className="settings-button"
                    onClick={() => {
                      setSearch("");
                      searchRef.current?.focus();
                    }}
                  >
                    Clear search
                  </button>
                </div>
              )}
            </div>
          ) : null}
          <div hidden={Boolean(term)}>
            <Outlet />
          </div>
          <footer className="settings-footer">
            <span>HIVEZ</span>
            <p>Your space to connect, contribute, and belong.</p>
          </footer>
        </div>
      </div>
    </div></div>
  );
}

function SettingsMobileNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <select
      id="settings-category"
      aria-label="Settings category"
      value={pathname}
      onChange={(event) => navigate(event.target.value)}
    >
      <option value="/settings">Overview</option>
      {SETTINGS_CATEGORIES.map((category) => (
        <option key={category.key} value={category.path}>
          {category.label}
        </option>
      ))}
    </select>
  );
}

function Settings() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { theme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const privacy = normalizePrivacy(profile);
  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      toast.error("Could not sign out. Please try again.");
      setLoggingOut(false);
    }
  }
  const featured = [
    {
      key: "appearance",
      kicker: "SET THE MOOD",
      title: "Find your light.",
      description: "A look that feels like you.",
      status: `${theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"} theme`,
      icon: Sun,
    },
    {
      key: "privacy",
      kicker: "YOUR CIRCLE, YOUR CALL",
      title: "Connect on your terms.",
      description: "Choose who can reach you.",
      status: `${privacy.account === "private" ? "Private" : "Public"} account`,
      icon: ShieldCheck,
    },
    {
      key: "notifications",
      kicker: "A LITTLE LESS NOISE",
      title: "Tune your buzz.",
      description: "Make every notification count.",
      status: "Manage notifications",
      icon: Bell,
    },
  ];
  return (
    <div className="settings-overview">
      <section className="settings-welcome">
        <div>
          <span className="settings-eyebrow">Small changes. Better days.</span>
          <h2>
            Make yourself
            <br />
            right at home.
          </h2>
          <p>
            From a quieter feed to a softer glow,
            <br className="settings-wide-only" /> the little things are yours to
            choose.
          </p>
          <Link to="/settings/appearance">
            Make it yours <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="settings-bee-scene" aria-hidden="true">
          <span className="settings-orbit settings-orbit-one" />
          <span className="settings-orbit settings-orbit-two" />
          <span className="settings-flower">&#10035;</span>
          <img src={beeStill} alt="" width="280" height="187" />
          <span className="settings-bee-caption">a place to bee yourself</span>
        </div>
      </section>
      <section className="settings-profile-strip" aria-label="Your profile">
        {profile?.photoURL || user?.photoURL ? (
          <img src={profile?.photoURL || user?.photoURL || ""} alt="" />
        ) : (
          <span className="settings-avatar">
            {(profile?.displayName || "H").slice(0, 1)}
          </span>
        )}
        <div>
          <strong>
            {profile?.displayName || user?.displayName || "Your Hivez profile"}
          </strong>
          <span>
            {profile?.username
              ? `@${profile.username}`
              : "Make your introduction to the hive"}
          </span>
        </div>
        <Link to="/profile/edit">
          Edit profile <ArrowUpRight size={15} />
        </Link>
      </section>
      <div className="settings-section-heading">
        <h2>Start with your everyday</h2>
        <span>A few things that make a difference</span>
      </div>
      <div className="settings-feature-grid">
        {featured.map((item) => (
          <Link
            to={`/settings/${item.key}`}
            className={`settings-feature settings-feature-${item.key}`}
            key={item.key}
          >
            <div className="settings-feature-top">
              <item.icon size={22} />
              <ArrowUpRight size={18} />
            </div>
            <span className="settings-eyebrow">{item.kicker}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <span className="settings-feature-status">
              {item.status}
              <ChevronRight size={14} />
            </span>
          </Link>
        ))}
      </div>
      <div className="settings-section-heading">
        <h2>Everything in its place</h2>
        <span>Explore all settings</span>
      </div>
      <div className="settings-directory">
        {NAV_GROUPS.map((group) => (
          <section key={group.label}>
            <SectionTitle title={group.label} />
            <SettingsSection
              className={
                group.label === "Your records" ? "settings-records-panel" : ""
              }
            >
              {group.keys.map((key) => {
                const category = SETTINGS_CATEGORIES.find(
                  (item) => item.key === key,
                )!;
                return (
                  <NavRow
                    key={key}
                    icon={category.icon}
                    title={category.label}
                    subtitle={category.description}
                    onClick={() => navigate(category.path)}
                  />
                );
              })}
            </SettingsSection>
          </section>
        ))}
      </div>
      <button
        className="settings-signout"
        disabled={loggingOut}
        onClick={() => void handleLogout()}
      >
        <LogOut size={17} />
        {loggingOut ? "Signing out…" : "Sign out of Hivez"}
      </button>
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
  const [privacy, setPrivacy] = useState<UserPrivacySettings>(() =>
    normalizePrivacy(profile),
  );
  const [savingKey, setSavingKey] = useState("");
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [emailForm, setEmailForm] = useState({ newEmail: "", password: "" });
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const isPasswordProvider =
    user?.providerData?.some((p) => p.providerId === "password") ?? false;

  useEffect(() => {
    setPrivacy(normalizePrivacy(profile));
  }, [profile]);

  async function updateAccount(next: UserPrivacySettings) {
    if (!user) return;
    setPrivacy(next);
    setSavingKey("account-privacy");
    try {
      await saveUserPrivacySettings(user.uid, next);
      toast.success("Privacy preference saved");
    } catch {
      setPrivacy(normalizePrivacy(profile));
      toast.error("Could not save your privacy preference. Please try again.");
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
      const credential = EmailAuthProvider.credential(
        user.email!,
        emailForm.password,
      );
      await reauthenticateWithCredential(user, credential);
      await updateEmail(user, newEmail);
      setEmailSuccess(true);
      setShowEmailForm(false);
      setEmailForm({ newEmail: "", password: "" });
      toast.success("Email updated successfully");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
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
      const credential = EmailAuthProvider.credential(
        user.email!,
        passwordForm.current,
      );
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordForm.next);
      setPasswordSuccess(true);
      setShowPasswordForm(false);
      setPasswordForm({ current: "", next: "", confirm: "" });
      toast.success("Password updated successfully");
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
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
      <section>
        <SectionTitle title="Your introduction" />
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
            subtitle={
              profile?.username ? `@${profile.username}` : "Set a username"
            }
            onClick={() => navigate("/profile/edit")}
          />
        </SettingsSection>
      </section>
      <section>
        <SectionTitle title="Contact & credentials" />
        <SettingsSection>
          <SettingRow
            icon={Mail}
            title="Email"
            subtitle={user?.email || "No email linked"}
          >
            {isPasswordProvider ? (
              <button
                type="button"
                className="settings-button secondary"
                disabled={Boolean(savingKey)}
                aria-expanded={showEmailForm}
                aria-controls="settings-email-form"
                onClick={() => {
                  setShowEmailForm(!showEmailForm);
                  setShowPasswordForm(false);
                  setEmailError("");
                }}
              >
                {showEmailForm ? "Cancel" : "Change email"}
              </button>
            ) : (
              <span className="settings-badge">Managed by provider</span>
            )}
          </SettingRow>
          {showEmailForm && isPasswordProvider && (
            <form
              id="settings-email-form"
              className="settings-credential-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleEmailChange();
              }}
            >
              <label>
                New email address
                <input
                  autoFocus
                  type="email"
                  autoComplete="email"
                  value={emailForm.newEmail}
                  disabled={Boolean(savingKey)}
                  onChange={(event) =>
                    setEmailForm({ ...emailForm, newEmail: event.target.value })
                  }
                />
              </label>
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={emailForm.password}
                  disabled={Boolean(savingKey)}
                  onChange={(event) =>
                    setEmailForm({ ...emailForm, password: event.target.value })
                  }
                />
              </label>
              {emailError && (
                <p className="settings-error" role="alert">
                  {emailError}
                </p>
              )}
              <button
                className="settings-button"
                type="submit"
                disabled={Boolean(savingKey)}
              >
                {savingKey === "email" ? "Updating..." : "Update email"}
              </button>
            </form>
          )}
          {emailSuccess && (
            <p className="settings-feedback" role="status">
              Email updated successfully.
            </p>
          )}
          <PlannedRow
            icon={Phone}
            title="Phone"
            subtitle={user?.phoneNumber || "No phone number linked"}
            note={user?.phoneNumber ? "Linked" : "Coming soon"}
          />
          <SettingRow
            icon={KeyRound}
            title="Password"
            subtitle={
              isPasswordProvider
                ? "Keep your account protected with a strong password."
                : "Managed by your sign-in provider."
            }
          >
            {isPasswordProvider ? (
              <button
                className="settings-button secondary"
                type="button"
                disabled={Boolean(savingKey)}
                aria-expanded={showPasswordForm}
                aria-controls="settings-password-form"
                onClick={() => {
                  setShowPasswordForm(!showPasswordForm);
                  setShowEmailForm(false);
                  setPasswordError("");
                }}
              >
                {showPasswordForm ? "Cancel" : "Change password"}
              </button>
            ) : (
              <span className="settings-badge">Social sign-in</span>
            )}
          </SettingRow>
          {showPasswordForm && isPasswordProvider && (
            <form
              id="settings-password-form"
              className="settings-credential-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handlePasswordChange();
              }}
            >
              <label>
                Current password
                <input
                  autoFocus
                  type="password"
                  autoComplete="current-password"
                  disabled={Boolean(savingKey)}
                  value={passwordForm.current}
                  onChange={(event) =>
                    setPasswordForm({
                      ...passwordForm,
                      current: event.target.value,
                    })
                  }
                />
              </label>
              <div>
                <label>
                  New password
                  <input
                    type="password"
                    aria-describedby="settings-password-hint"
                    autoComplete="new-password"
                    disabled={Boolean(savingKey)}
                    value={passwordForm.next}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        next: event.target.value,
                      })
                    }
                  />
                </label>
                <small id="settings-password-hint">
                  Use at least 6 characters.
                </small>
              </div>
              <label>
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  disabled={Boolean(savingKey)}
                  value={passwordForm.confirm}
                  onChange={(event) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirm: event.target.value,
                    })
                  }
                />
              </label>
              {passwordError && (
                <p className="settings-error" role="alert">
                  {passwordError}
                </p>
              )}
              <button
                className="settings-button"
                type="submit"
                disabled={Boolean(savingKey)}
              >
                {savingKey === "password" ? "Updating..." : "Update password"}
              </button>
            </form>
          )}
          {passwordSuccess && (
            <p className="settings-feedback" role="status">
              Password updated successfully.
            </p>
          )}
        </SettingsSection>
      </section>
      <section>
        <SectionTitle title="Part of the hive" />
        <SettingsSection>
          <SettingRow
            icon={ShieldCheck}
            title="Account status"
            subtitle="You are signed in to Hivez."
          >
            <span className="settings-badge">Signed in</span>
          </SettingRow>
          <SettingRow
            icon={CalendarDays}
            title="Joined Hivez"
            subtitle={joinDate}
          >
            <span />
          </SettingRow>
        </SettingsSection>
      </section>
      <section>
        <SectionTitle title="Your circle" />
        <SettingsSection>
          <OptionRow
            icon={Lock}
            title="Account privacy"
            subtitle="Private accounts require approval before protected posts and ReHives are visible."
            value={privacy.account}
            disabled={Boolean(savingKey)}
            options={[
              { value: "public", label: "Public" },
              { value: "private", label: "Private" },
            ]}
            onChange={(value) =>
              void updateAccount({
                ...privacy,
                account: value,
                messages:
                  value === "private" && privacy.messages === "everyone"
                    ? "followers"
                    : privacy.messages,
              })
            }
          />
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
  const [privacy, setPrivacy] = useState<UserPrivacySettings>(() =>
    normalizePrivacy(profile),
  );
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
      toast.success("Privacy preference saved");
    } catch {
      setPrivacy(normalizePrivacy(profile));
      toast.error("Could not save your privacy preference. Please try again.");
    } finally {
      setSavingKey("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2.5">
        <SectionTitle title="Privacy" />
        <SettingsSection>
          <OptionRow
            icon={Lock}
            title="Account privacy"
            subtitle="Private accounts require approval before protected posts and ReHives are visible."
            value={privacy.account}
            disabled={Boolean(savingKey)}
            options={[
              { value: "public", label: "Public" },
              { value: "private", label: "Private" },
            ]}
            onChange={(value) =>
              void updatePrivacy(
                {
                  ...privacy,
                  account: value,
                  messages:
                    value === "private" && privacy.messages === "everyone"
                      ? "followers"
                      : privacy.messages,
                },
                "account",
              )
            }
          />

          <OptionRow
            icon={MessageCircle}
            title="Messages"
            subtitle="Controls who can start or receive post shares through Direct Messages."
            disabled={Boolean(savingKey)}
            options={MESSAGE_OPTIONS}
            value={privacy.messages}
            onChange={(messages) =>
              updatePrivacy({ ...privacy, messages }, "messages")
            }
          />

          <OptionRow
            icon={AtSign}
            title="Mentions"
            subtitle="Controls who can notify you with comment mentions."
            disabled={Boolean(savingKey)}
            options={INTERACTION_OPTIONS}
            value={privacy.mentions}
            onChange={(mentions) =>
              updatePrivacy({ ...privacy, mentions }, "mentions")
            }
          />

          <OptionRow
            icon={MessageCircle}
            title="Comments"
            subtitle="Controls who can comment on your posts."
            disabled={Boolean(savingKey)}
            options={INTERACTION_OPTIONS}
            value={privacy.comments}
            onChange={(comments) =>
              updatePrivacy({ ...privacy, comments }, "comments")
            }
          />

          <SettingRow
            icon={Eye}
            title="Discoverability"
            subtitle="Allow your profile to appear in people search suggestions."
          >
            <Switch
              checked={privacy.discoverable}
              disabled={Boolean(savingKey)}
              onClick={() =>
                updatePrivacy(
                  { ...privacy, discoverable: !privacy.discoverable },
                  "discoverable",
                )
              }
            />
          </SettingRow>

          <OptionRow
            icon={Tag}
            title="Tags"
            subtitle="Controls tagging in posts and comments. Shares your Mentions preference."
            disabled={Boolean(savingKey)}
            options={INTERACTION_OPTIONS}
            value={privacy.mentions}
            onChange={(tags) =>
              updatePrivacy({ ...privacy, mentions: tags }, "tags")
            }
          />
          <SettingRow
            icon={MapPin}
            title="Location sharing"
            subtitle="Control whether your posts can include location data."
          >
            <span className="settings-badge">Off by default</span>
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
  const isPasswordProvider =
    user?.providerData?.some((p) => p.providerId === "password") ?? false;
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle title="How you sign in" />
        <SettingsSection>
          <SettingRow
            icon={ShieldCheck}
            title="Sign-in method"
            subtitle={
              isPasswordProvider
                ? "Email and password"
                : "Google social sign-in"
            }
          >
            <span className="settings-badge">Active</span>
          </SettingRow>
          {isPasswordProvider && (
            <div className="pb-4">
              <Link
                className="settings-button secondary"
                to="/settings/account"
              >
                Manage your password <ArrowUpRight size={15} />
              </Link>
            </div>
          )}
        </SettingsSection>
      </section>
      <section>
        <SectionTitle title="Additional protection" />
        <SettingsSection>
          <PlannedRow
            icon={Lock}
            title="Two-factor authentication"
            subtitle="An extra verification step when you sign in."
          />
          <PlannedRow
            icon={Fingerprint}
            title="Passkeys"
            subtitle="Sign in with your device's fingerprint, face, or screen lock."
          />
          <PlannedRow
            icon={Laptop}
            title="Devices"
            subtitle="Review and manage the devices signed in to your account."
          />
          <PlannedRow
            icon={Shield}
            title="Login activity"
            subtitle="Review recent sign-ins to your account."
          />
        </SettingsSection>
      </section>
      <p className="settings-note">
        Additional protection features are not available yet. If you use Google
        to sign in, you can manage sign-in protection in your Google account.
      </p>
    </div>
  );
}
// ============================================================
// NOTIFICATIONS   (consolidated from NotificationsSettings.tsx)
// ============================================================

/* eslint-disable react-hooks/set-state-in-effect */

type NotificationKey =
  "likes" | "comments" | "reHives" | "mentions" | "follows" | "messages";

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
  const [notificationPrefs, setNotificationPrefs] = useState<
    Record<NotificationKey, boolean>
  >({
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
      ...((profile?.notificationPreferences || {}) as Partial<
        Record<NotificationKey, boolean>
      >),
    }));
  }, [profile]);

  async function handleEnableNotifications() {
    if (!user) return;
    setSavingKey("push");
    try {
      await enablePushNotifications(user.uid);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not enable notifications.";
      toast.error(message);
    } finally {
      setSavingKey("");
    }
  }

  async function updateNotificationPreference(
    key: NotificationKey,
    value: boolean,
  ) {
    if (!user) return;
    setNotificationPrefs((current) => ({ ...current, [key]: value }));
    setSavingKey(`notification-${key}`);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { notificationPreferences: { [key]: value } },
        { merge: true },
      );
      toast.success("Notification preference saved");
    } catch {
      setNotificationPrefs((current) => ({ ...current, [key]: !value }));
      toast.error(
        "Could not save your notification preference. Please try again.",
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
          <SettingRow
            icon={Bell}
            title="In-app notifications"
            subtitle="Alert channels Hivez creates for your account."
          >
            <span className="settings-badge">On</span>
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
                disabled={Boolean(savingKey)}
                onClick={() =>
                  updateNotificationPreference(
                    item.key,
                    notificationPrefs[item.key] === false,
                  )
                }
              />
            </SettingRow>
          ))}
        </SettingsSection>
      </section>

      <section className="space-y-2.5">
        <SectionTitle title="Delivery channels" />
        <SettingsSection>
          <SettingRow
            icon={Bell}
            title="Push notifications"
            subtitle="Enable device alerts for Hivez activity."
          >
            <button
              type="button"
              onClick={() => void handleEnableNotifications()}
              disabled={Boolean(savingKey)}
              className="settings-button"
            >
              {savingKey === "push" ? "Enabling..." : "Enable"}
            </button>
          </SettingRow>
          <PlannedRow
            icon={Bell}
            title="Email notifications"
            subtitle="Receive activity digests by email."
            note="Coming soon"
          />
          <PlannedRow
            icon={Bell}
            title="SMS notifications"
            subtitle="Receive important alerts by text message."
            note="Coming soon"
          />
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
  const [contentPref, setContentPref] = useState<SensitiveContentPreference>(
    () => sensitiveContentPreference(profile),
  );
  const [savingPreference, setSavingPreference] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  useEffect(() => {
    const prefs = profile?.preferences as Record<string, unknown> | undefined;
    setContentPref(sensitiveContentPreference(profile));
    setSelectedTopics(
      Array.isArray(prefs?.topics) ? (prefs.topics as string[]) : [],
    );
    setSelectedInterests(
      Array.isArray(prefs?.interests) ? (prefs.interests as string[]) : [],
    );
  }, [profile]);

  async function updatePreference(value: SensitiveContentPreference) {
    if (!user) return;
    const previous = contentPref;
    setContentPref(value);
    setSavingPreference(true);
    try {
      await saveSensitiveContentPreference(user.uid, value);
    } catch (error) {
      console.error("Failed to save sensitive content preference:", error);
      setContentPref(previous);
      toast.error("Could not save your content preference. Please try again.");
    } finally {
      setSavingPreference(false);
    }
  }

  async function savePreference(key: string, value: string[]) {
    if (!user) return;
    setSavingPreference(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { preferences: { [key]: value } },
        { merge: true },
      );
      toast.success("Preferences saved");
    } catch (error) {
      console.error("Failed to save preference:", error);
      toast.error("Could not save preferences.");
      const previous = profile?.preferences as
        Record<string, unknown> | undefined;
      if (key === "topics")
        setSelectedTopics(
          Array.isArray(previous?.topics) ? (previous.topics as string[]) : [],
        );
      if (key === "interests")
        setSelectedInterests(
          Array.isArray(previous?.interests)
            ? (previous.interests as string[])
            : [],
        );
    } finally {
      setSavingPreference(false);
    }
  }

  const TOPICS = [
    "Environment",
    "Education",
    "Health",
    "Infrastructure",
    "Safety",
    "Community",
    "Technology",
    "Culture",
  ];
  const INTERESTS = [
    "Volunteering",
    "Community Building",
    "Emergency Response",
    "Mentorship",
    "Fundraising",
    "Advocacy",
  ];

  function toggleTopic(topic: string) {
    const next = selectedTopics.includes(topic)
      ? selectedTopics.filter((t) => t !== topic)
      : [...selectedTopics, topic];
    setSelectedTopics(next);
    void savePreference("topics", next);
  }

  function toggleInterest(interest: string) {
    const next = selectedInterests.includes(interest)
      ? selectedInterests.filter((i) => i !== interest)
      : [...selectedInterests, interest];
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
            disabled={savingPreference}
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
        <p className="settings-section-description">
          Choose the subjects you care about. Your selections are saved to your
          profile.
        </p>
        <SettingsSection>
          <div className="settings-choice-grid">
            {TOPICS.map((topic) => (
              <button
                key={topic}
                aria-pressed={selectedTopics.includes(topic)}
                disabled={savingPreference}
                type="button"
                onClick={() => toggleTopic(topic)}
                className="settings-choice-chip"
              >
                {topic}
              </button>
            ))}
          </div>
        </SettingsSection>
      </section>

      <section className="space-y-2.5">
        <SectionTitle title="Interests" />
        <p className="settings-section-description">
          What brings you to the community? Pick as many as you like.
        </p>
        <SettingsSection>
          <div className="settings-choice-grid">
            {INTERESTS.map((interest) => (
              <button
                key={interest}
                aria-pressed={selectedInterests.includes(interest)}
                disabled={savingPreference}
                type="button"
                onClick={() => toggleInterest(interest)}
                className="settings-choice-chip"
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

function TextSizeControl() {
  const { fontSize, setFontSize } = useTheme();
  return (
    <OptionRow
      icon={Type}
      title="Text size"
      subtitle="A comfortable size for everything you read."
      value={fontSize}
      onChange={setFontSize}
      options={[
        { value: "small", label: "Small" },
        { value: "default", label: "Default" },
        { value: "large", label: "Large" },
      ]}
    />
  );
}
function ReadingPreview() {
  return (
    <div className="settings-reading-preview" aria-label="Text size preview">
      <span>A little preview</span>
      <h3>Good things grow together.</h3>
      <p>
        A shared idea. A helping hand. A small act that makes your community a
        little brighter.
      </p>
    </div>
  );
}
function AppearanceSettings() {
  const { theme, setTheme, reducedMotion, setReducedMotion } = useTheme();
  const themes = [
    {
      value: "light" as const,
      label: "Light",
      note: "A fresh start",
      icon: Sun,
    },
    {
      value: "dark" as const,
      label: "Dark",
      note: "A softer glow",
      icon: Moon,
    },
    {
      value: "system" as const,
      label: "System",
      note: "Follow your device",
      icon: Laptop,
    },
  ];
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle title="Choose your atmosphere" />
        <SettingsSection>
          <div className="settings-row">
            <div>
              <p className="settings-row-title">
                A different light. The same hive.
              </p>
              <p className="settings-row-description">
                Find your comfortable corner, from morning to midnight.
              </p>
            </div>
          </div>
          <div
            className="settings-theme-grid"
            role="group"
            aria-label="App theme"
          >
            {themes.map((item) => (
              <button
                type="button"
                key={item.value}
                aria-pressed={theme === item.value}
                className="settings-theme-card"
                onClick={() => setTheme(item.value)}
              >
                <span
                  className="settings-theme-preview"
                  data-theme={item.value}
                  aria-hidden="true"
                >
                  <span className="settings-mini-sidebar">
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="settings-mini-content">
                    <b />
                    <span />
                    <i />
                    <i />
                  </span>
                </span>
                <span className="settings-theme-label">
                  <span>
                    <item.icon size={14} />
                    {item.label}
                  </span>
                  <span className="settings-theme-check">
                    {theme === item.value && <Check size={12} />}
                  </span>
                </span>
                <small>{item.note}</small>
              </button>
            ))}
          </div>
        </SettingsSection>
      </section>
      <section>
        <SectionTitle title="Room to read" />
        <SettingsSection>
          <TextSizeControl />
          <ReadingPreview />
        </SettingsSection>
      </section>
      <section>
        <SectionTitle title="At your pace" />
        <SettingsSection>
          <SettingRow
            icon={Sparkles}
            title="Reduce motion"
            subtitle="Keep things still by minimizing interface animations."
          >
            <Switch
              checked={reducedMotion}
              onClick={() => setReducedMotion(!reducedMotion)}
            />
          </SettingRow>
        </SettingsSection>
      </section>
      <p className="settings-note">
        Appearance preferences are saved on this device. Choose System to follow
        your device's light and dark schedule.
      </p>
    </div>
  );
}
function AccessibilitySettings() {
  const { reducedMotion, setReducedMotion, highContrast, setHighContrast } =
    useTheme();
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle title="Make yourself comfortable" />
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
            icon={Contrast}
            title="High contrast"
            subtitle="Make text and surface boundaries easier to distinguish."
          >
            <Switch
              checked={highContrast}
              onClick={() => setHighContrast(!highContrast)}
            />
          </SettingRow>
        </SettingsSection>
      </section>
      <section>
        <SectionTitle title="Reading comfort" />
        <SettingsSection>
          <TextSizeControl />
          <ReadingPreview />
        </SettingsSection>
      </section>
      <p className="settings-note">
        These preferences are saved on this device. Text size and motion
        settings stay in sync with Appearance.
      </p>
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
  const [currentLang, setCurrentLang] = useState<string>(
    () =>
      ((profile?.preferences as Record<string, unknown> | undefined)
        ?.language as string) || "en-US",
  );
  useEffect(() => {
    setCurrentLang(
      ((profile?.preferences as Record<string, unknown> | undefined)
        ?.language as string) || "en-US",
    );
  }, [profile]);
  async function handleLanguageChange(code: string) {
    if (!user || code === currentLang) return;
    const previous = currentLang;
    setCurrentLang(code);
    setSaving(true);
    try {
      await setDoc(
        doc(db, "users", user.uid),
        { preferences: { language: code } },
        { merge: true },
      );
      toast.success("Language preference saved");
    } catch (error) {
      console.error("Failed to save language:", error);
      setCurrentLang(previous);
      toast.error("Could not save language preference.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-6">
      <p className="settings-note">
        Choose your display language. English (US) is currently supported; more
        languages are on the way.
      </p>
      <section>
        <SectionTitle title="Display language" />
        <SettingsSection>
          {LANGUAGES.map((lang) => (
            <SettingRow
              key={lang.code}
              icon={Languages}
              title={lang.label}
              subtitle={
                lang.available ? "Available across Hivez" : "Not available yet"
              }
            >
              {lang.available ? (
                <button
                  type="button"
                  className="settings-button secondary"
                  disabled={saving}
                  aria-pressed={currentLang === lang.code}
                  onClick={() => void handleLanguageChange(lang.code)}
                >
                  {currentLang === lang.code && (
                    <Check size={15} aria-hidden="true" />
                  )}
                  {currentLang === lang.code ? "Selected" : "Select"}
                </button>
              ) : (
                <span className="settings-badge">Soon</span>
              )}
            </SettingRow>
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
  const [confirmCache, setConfirmCache] = useState(false);
  const [cacheRevision, setCacheRevision] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [usage, setUsage] = useState<{
    localStorage: string;
    estimated: string;
  } | null>(null);

  useEffect(() => {
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) totalBytes += (localStorage.getItem(key)?.length ?? 0) * 2;
    }
    const fmt = (b: number) =>
      b < 1024
        ? `${b} B`
        : b < 1048576
          ? `${(b / 1024).toFixed(1)} KB`
          : `${(b / 1048576).toFixed(1)} MB`;
    setUsage({ localStorage: fmt(totalBytes), estimated: fmt(totalBytes) });
  }, [cacheRevision]);

  async function handleClearCache() {
    setClearing(true);
    try {
      // This is the only disposable persisted cache currently owned by Hivez.
      // Local chats, appearance preferences and a chosen location are user data.
      localStorage.removeItem("hivez.last-map-center");
      setCacheRevision((revision) => revision + 1);
      setConfirmCache(false);
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
      const followsData: { followers: unknown[]; following: unknown[] } = {
        followers: [],
        following: [],
      };
      const exportData: Record<string, unknown> = {
        exportedAt: new Date().toISOString(),
        profile: null,
        posts: [] as unknown[],
        comments: [] as unknown[],
        follows: followsData,
        settings: {} as Record<string, unknown>,
      };
      const profileSnap = await getDoc(doc(db, "users", user.uid));
      if (profileSnap.exists()) {
        const p = profileSnap.data();
        exportData.profile = {
          displayName: p.displayName,
          username: p.username,
          bio: p.bio,
          photoURL: p.photoURL,
          verified: p.verified,
          followers: p.followers,
          following: p.following,
          posts: p.posts,
          createdAt: p.createdAt,
        };
        exportData.settings = {
          privacy: p.privacy,
          notificationPreferences: p.notificationPreferences,
          preferences: p.preferences,
        };
      }
      const postsSnap = await getDocs(
        query(collection(db, "posts"), where("uid", "==", user.uid)),
      );
      exportData.posts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const commentsSnap = await getDocs(
        query(collection(db, "comments"), where("uid", "==", user.uid)),
      );
      exportData.comments = commentsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      const followersSnap = await getDocs(
        collection(db, "users", user.uid, "followers"),
      );
      const followingSnap = await getDocs(
        collection(db, "users", user.uid, "following"),
      );
      followsData.followers = followersSnap.docs.map((d) => d.data());
      followsData.following = followingSnap.docs.map((d) => d.data());
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
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
              className="settings-button"
            >
              {exporting ? "Exporting..." : "Export"}
            </button>
          </SettingRow>
          <SettingRow
            icon={Database}
            title="Data usage"
            subtitle={
              usage
                ? `Local storage: ${usage.localStorage} (estimated)`
                : "Calculating..."
            }
          >
            <span className="settings-badge">Local only</span>
          </SettingRow>
          <SettingRow
            icon={Trash2}
            title="Clear cache"
            subtitle="Reset the cached map position on this device. Your preferences, local chats, and posts are kept."
          >
            <button
              type="button"
              onClick={() => setConfirmCache(true)}
              disabled={clearing}
              className="settings-button secondary"
            >
              {clearing ? "Clearing..." : "Clear cache"}
            </button>
          </SettingRow>
        </SettingsSection>
      </section>
      {confirmCache && (
        <ConfirmationDialog
          title="Clear on-device cache?"
          confirmLabel="Clear cache"
          busy={clearing}
          onClose={() => setConfirmCache(false)}
          onConfirm={() => void handleClearCache()}
        >
          The cached map position will be reset. Your account, posts, local
          chats, and appearance preferences will stay in place.
        </ConfirmationDialog>
      )}
    </div>
  );
}
// ============================================================
// DELETE / DEACTIVATE   (consolidated from DeleteAccountSettings.tsx)
// ============================================================

function ConfirmationDialog({
  title,
  children,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="settings-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <AlertTriangle size={26} aria-hidden="true" />
      <h2 id={titleId}>{title}</h2>
      <p id={descriptionId}>{children}</p>
      <div className="settings-dialog-actions">
        <button
          type="button"
          className="settings-button secondary"
          disabled={busy}
          onClick={onClose}
          autoFocus
        >
          Cancel
        </button>
        <button
          type="button"
          className="settings-button"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Working..." : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
function DeleteAccountSettings() {
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirming, setConfirming] = useState(false);
  async function handleConfirm() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      toast.error("Could not sign out. Please try again.");
      setLoggingOut(false);
    }
  }
  return (
    <div className="space-y-6">
      <p className="settings-note">
        Your account and contributions matter. Account deactivation and
        permanent deletion are not available in the app yet. Contact Hivez
        support if you need your account permanently removed.
      </p>
      <section>
        <SectionTitle title="Know your options" />
        <SettingsSection>
          <PlannedRow
            icon={User}
            title="Deactivate account"
            subtitle="Temporarily hiding your profile and posts is not available yet."
          />
          <PlannedRow
            icon={Trash2}
            title="Delete account"
            subtitle="Permanent account removal requires help from Hivez support."
            note="Contact support"
          />
        </SettingsSection>
      </section>
      <section>
        <SectionTitle title="Just need a break?" />
        <SettingsSection>
          <SettingRow
            icon={LogOut}
            title="Sign out"
            subtitle="You can come back any time. Your profile, posts, and account stay in Hivez."
          >
            <button
              type="button"
              className="settings-button secondary"
              onClick={() => setConfirming(true)}
            >
              Sign out
            </button>
          </SettingRow>
        </SettingsSection>
      </section>
      {confirming && (
        <ConfirmationDialog
          title="Until next time?"
          confirmLabel="Sign out"
          busy={loggingOut}
          onClose={() => setConfirming(false)}
          onConfirm={() => void handleConfirm()}
        >
          This signs you out of Hivez. It does not deactivate or delete your
          account, and your data stays in place.
        </ConfirmationDialog>
      )}
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
