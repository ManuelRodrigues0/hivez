import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, Sparkles } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { logout } from "../../services/auth";
import { SETTINGS_CATEGORIES } from "./settingsNav";
import { NavRow, SettingsSection } from "./settingsUi";

/**
 * Settings hub (/settings). Shows the account summary card, the full category
 * list and sign-out — the entry point into every dedicated settings view.
 */
export default function Settings() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <SettingsSection>
        <button type="button" onClick={() => navigate("/profile/edit")} className="flex w-full items-center gap-4 text-left">
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
      </SettingsSection>

      <SettingsSection>
        {SETTINGS_CATEGORIES.map((cat) => (
          <NavRow
            key={cat.key}
            icon={cat.icon}
            title={cat.label}
            subtitle={cat.description}
            onClick={() => navigate(cat.path)}
          />
        ))}
      </SettingsSection>

      <div className="w-full pb-10 pt-2">
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 px-4 py-3.5 text-xs font-bold text-rose-700 shadow-xs transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
        >
          <LogOut size={16} />
          <span>{loggingOut ? "Logging out..." : "Sign Out from Hivez"}</span>
        </button>
      </div>
    </>
  );
}