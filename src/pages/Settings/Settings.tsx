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
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { logout } from "../../services/auth";
import { enablePushNotifications } from "@/services/pushNotifications";

interface SettingsItem {
  icon: LucideIcon;
  label: string;
  onClick: (e?: any) => void;
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

  async function handleEnableNotifications() {
    if (!user) return;
    try {
      await enablePushNotifications(user.uid);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not enable notifications.";
      console.error(message);
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
          subtitle: "Display name, bio, and avatar",
        },
        {
          icon: Bell,
          label: "Push Notifications",
          onClick: handleEnableNotifications,
          subtitle: "Real-time municipal triage & reply alerts",
        },
        {
          icon: Lock,
          label: "Privacy & Security",
          onClick: () => {},
          subtitle: "Location sharing & session security",
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
          toggle: true,
          value: theme === "dark",
          subtitle: "Switch appearance mode",
        },
        {
          icon: Smartphone,
          label: "Mobile Data Saver",
          onClick: () => {},
          subtitle: "Optimize image uploads on cellular networks",
        },
      ],
    },
    {
      title: "Support & Identity",
      items: [
        {
          icon: HelpCircle,
          label: "Help & FAQ",
          onClick: () => {},
          subtitle: "Incident reporting guides & triage workflow",
        },
        {
          icon: Info,
          label: "About Hivez",
          onClick: () => {},
          subtitle: "Version 1.0.0 • Verified Civic Engine",
        },
      ],
    },
  ];

  return (
    <div className="w-full min-h-screen px-4 py-5 md:px-8 space-y-6 select-none">
      {/* Top Banner Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1c1d1a]/10 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-white text-[#1c1d1a] shadow-2xs transition hover:bg-[#ecece5] dark:border-neutral-800 dark:bg-[#141414] dark:text-white dark:hover:bg-neutral-800"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-[#1c1d1a] dark:text-white">Settings</h1>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#3d654c] dark:text-[#f2c14e]">
              Preferences & System Controls
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-[#3d654c]/20 bg-[#3d654c]/10 px-3 py-1 text-[11px] font-bold text-[#3d654c] dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
          <ShieldCheck size={14} />
          <span>Active Ward</span>
        </div>
      </div>

      {/* Main Settings Container */}
      <div className="w-full space-y-6">
        {/* Profile Card */}
        <div className="w-full rounded-2xl border border-[#1c1d1a]/10 bg-white p-4 shadow-xs transition hover:border-[#3d654c]/30 dark:border-neutral-800/90 dark:bg-[#121212] dark:hover:border-[#f2c14e]/30 md:p-5">
          <button
            onClick={() => navigate("/profile/edit")}
            className="flex w-full items-center gap-4 text-left"
          >
            <div className="relative shrink-0">
              <img
                src={user?.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=3d654c&color=fff"}
                alt="Profile"
                className="h-14 w-14 rounded-2xl border-2 border-[#3d654c]/20 object-cover shadow-xs dark:border-[#f2c14e]/20"
              />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#3d654c] text-[9px] text-white dark:bg-[#f2c14e] dark:text-[#121212]">
                <Sparkles size={9} />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-black text-[#1c1d1a] dark:text-white">
                  {user?.displayName || "Hivez Contributor"}
                </p>
                <span className="shrink-0 rounded-full bg-[#f3f4ee] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#3d654c] dark:bg-[#1c1c1c] dark:text-[#f2c14e]">
                  Citizen
                </span>
              </div>
              <p className="truncate text-xs font-medium text-[#1c1d1a]/60 dark:text-neutral-400 mt-0.5">
                {user?.email || "Signed in with Civic Auth"}
              </p>
            </div>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f7f7f2] text-[#1c1d1a]/40 transition hover:bg-[#3d654c] hover:text-white dark:bg-[#1a1a1a] dark:text-neutral-400 dark:hover:bg-[#f2c14e] dark:hover:text-[#121212]">
              <ChevronRight size={17} />
            </div>
          </button>
        </div>

        {/* Settings Sections */}
        {settingsSections.map((section) => (
          <div key={section.title} className="w-full space-y-2">
            <h2 className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#1c1d1a]/45 dark:text-neutral-500">
              {section.title}
            </h2>

            <div className="w-full overflow-hidden rounded-2xl border border-[#1c1d1a]/10 bg-white shadow-xs dark:border-neutral-800/90 dark:bg-[#121212]">
              {section.items.map((item, index) => {
                const Icon = item.icon;
                const hasToggle = item.toggle !== undefined;
                return (
                  <button
                    key={item.label}
                    onClick={(e) => item.onClick(e)}
                    className={`group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-[#1c1d1a]/3 dark:hover:bg-white/5 ${
                      index !== section.items.length - 1
                        ? "border-b border-[#1c1d1a]/5 dark:border-neutral-800/60"
                        : ""
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] shadow-2xs transition group-hover:scale-105 group-hover:bg-white dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-[#f2c14e] dark:group-hover:bg-[#222]">
                      <Icon size={17} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="block truncate text-xs font-bold text-[#1c1d1a] dark:text-white">
                        {item.label}
                      </span>
                      {item.subtitle && (
                        <p className="truncate text-[11px] font-medium text-[#1c1d1a]/55 dark:text-neutral-400 mt-0.5">
                          {item.subtitle}
                        </p>
                      )}
                    </div>

                    {hasToggle ? (
                      <div
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                          item.value ? "bg-[#3d654c] dark:bg-[#f2c14e]" : "bg-neutral-200 dark:bg-neutral-800"
                        }`}
                      >
                        <div
                          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 dark:bg-[#121212] ${
                            item.value ? "left-5.5" : "left-0.5"
                          }`}
                        />
                      </div>
                    ) : (
                      <ChevronRight
                        size={15}
                        className="shrink-0 text-[#1c1d1a]/30 transition group-hover:translate-x-0.5 group-hover:text-[#1c1d1a]/60 dark:text-neutral-600 dark:group-hover:text-neutral-400"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Logout Button */}
        <div className="w-full pt-2 pb-10">
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
    </div>
  );
}