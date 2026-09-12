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
  /** Categories that live at a dedicated route outside /settings/*. */
  external?: boolean;
}

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { key: "account", label: "Account", description: "Personal info, username, email, join date, account status", path: "/settings/account", icon: User },
  { key: "privacy", label: "Privacy", description: "Account privacy, messages, mentions, comments, discoverability", path: "/settings/privacy", icon: Lock },
  { key: "security", label: "Security", description: "Two-factor authentication, passkeys, login activity, devices", path: "/settings/security", icon: Shield },
  { key: "notifications", label: "Notifications", description: "Push, in-app and per-activity alert preferences", path: "/settings/notifications", icon: Bell },
  { key: "content", label: "Content preferences", description: "Sensitive content, languages, topics and interests", path: "/settings/content", icon: Eye },
  { key: "appearance", label: "Appearance", description: "Light and dark theme, font size, animations", path: "/settings/appearance", icon: Moon },
  { key: "accessibility", label: "Accessibility", description: "Reduced motion and reading preferences", path: "/settings/accessibility", icon: Accessibility },
  { key: "language", label: "Language", description: "Display language for Hivez", path: "/settings/language", icon: Languages },
  { key: "data", label: "Data", description: "Download, usage and on-device cache", path: "/settings/data", icon: Database },
  { key: "saved", label: "Saved posts", description: "Posts you have bookmarked — private to you", path: "/saved", icon: Bookmark, external: true },
  { key: "activity", label: "Your activity", description: "Alerts and interactions across your account", path: "/activity", icon: Activity, external: true },
  { key: "delete", label: "Delete / deactivate", description: "Temporarily or permanently close your account", path: "/settings/delete", icon: Trash2 },
];