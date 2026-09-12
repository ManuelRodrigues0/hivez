import {
  Accessibility,
  Activity,
  Bell,
  Bookmark,
  Database,
  Eye,
  Languages,
  Lock,
  Moon,
  Shield,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";

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