import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Moon,
  Sun,
  User,
  Bell,
  Lock,
  HelpCircle,
  Info,
  LogOut,
  Smartphone,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { logout } from "../../services/auth";

interface SettingsItem {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  color: string;
  subtitle?: string;
  toggle?: boolean;
  value?: boolean;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
    }
  }

  const settingsSections: SettingsSection[] = [
    {
      title: "Account",
      items: [
        {
          icon: User,
          label: "Edit Profile",
          onClick: () => navigate("/profile/edit"),
          color: "text-blue-500",
        },
        {
          icon: Bell,
          label: "Notifications",
          onClick: () => {},
          color: "text-pink-500",
        },
        {
          icon: Lock,
          label: "Privacy & Security",
          onClick: () => {},
          color: "text-green-500",
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: theme === "dark" ? Moon : Sun,
          label: theme === "dark" ? "Dark Mode" : "Light Mode",
          onClick: toggleTheme,
          color: "text-yellow-500",
          toggle: true,
          value: theme === "dark",
        },
        {
          icon: Smartphone,
          label: "Mobile Data Saver",
          onClick: () => {},
          color: "text-purple-500",
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: HelpCircle,
          label: "Help Center",
          onClick: () => {},
          color: "text-cyan-500",
        },
        {
          icon: Info,
          label: "About",
          onClick: () => {},
          color: "text-zinc-500",
          subtitle: "Version 1.0.0",
        },
      ],
    },
  ];

  return (
    <div className="app-page">
      {/* Header */}
      <div className="app-sticky-header">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="app-icon-button"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-base font-semibold">Settings</h1>
        </div>
      </div>

      {/* Profile Card */}
      <div className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800">
        <button
          onClick={() => navigate("/profile/edit")}
          className="app-surface flex w-full items-center gap-3 p-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
        >
          <img
            src={user?.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"}
            alt="Profile"
            className="h-14 w-14 rounded-full object-cover"
          />
          <div className="flex-1 text-left">
            <p className="font-semibold">{user?.displayName || "Hivez User"}</p>
            <p className="text-sm text-zinc-500">{user?.email || ""}</p>
          </div>
          <ArrowLeft size={18} className="rotate-180 text-zinc-400" />
        </button>
      </div>

      {/* Settings Sections */}
      <div className="px-4 py-4">
        {settingsSections.map((section) => (
          <div key={section.title} className="mb-6">
            <h2 className="app-section-label mb-2 px-1">
              {section.title}
            </h2>
            <div className="app-surface overflow-hidden">
              {section.items.map((item, index) => {
                const Icon = item.icon;
                const hasToggle = item.toggle !== undefined;
                return (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                      index !== section.items.length - 1
                        ? "border-b border-zinc-200 dark:border-zinc-800"
                        : ""
                    }`}
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 ${item.color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.subtitle && (
                        <p className="text-xs text-zinc-500">{item.subtitle}</p>
                      )}
                    </div>
                    {hasToggle ? (
                      <div
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          item.value ? "bg-black dark:bg-white" : "bg-zinc-300 dark:bg-zinc-600"
                        }`}
                      >
                        <div
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform dark:bg-black ${
                            item.value ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </div>
                    ) : (
                      <ArrowLeft size={16} className="rotate-180 text-zinc-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="px-4 pb-8">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-red-200 px-4 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950"
        >
          <LogOut size={18} />
          {loggingOut ? "Logging out..." : "Log Out"}
        </button>
      </div>
    </div>
  );
}
