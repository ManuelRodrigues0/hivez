import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, Sparkles } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { logout } from "../../services/auth";
import { normalizePrivacy } from "../../services/privacy";
import { SETTINGS_CATEGORIES, SETTINGS_GROUPS } from "./settingsNav";
import { NavRow, SectionTitle, SettingsSection } from "./settingsUi";

/**
 * Settings hub (/settings). Shows a compact account summary card, the top-level
 * categories grouped under small section labels, and sign-out — the entry
 * point into every dedicated settings view.
 */
export default function Settings() {
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
    <>
      <section className="w-full">
        <SectionTitle title="Profile" />
        <SettingsSection>
          <button
            type="button"
            onClick={() => navigate("/profile/edit")}
            className="flex w-full items-center gap-3 text-left transition hover:bg-[#f7f7f2]/70 focus-visible:ring-2 focus-visible:ring-[#3d654c]/40 focus-visible:ring-offset-1 dark:hover:bg-white/5"
          >
            <div className="relative shrink-0">
              <img
                src={profile?.photoURL || user?.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=3d654c&color=fff"}
                alt=""
                className="h-11 w-11 rounded-2xl border-2 border-[#3d654c]/20 object-cover shadow-xs dark:border-[#f2c14e]/20"
              />
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]">
                <Sparkles size={8} />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-black text-[#1c1d1a] dark:text-white">
                {profile?.displayName || user?.displayName || "Hivez Contributor"}
              </p>
              <p className="truncate text-[11px] font-medium text-[#1c1d1a]/60 dark:text-neutral-400">
                @{profile?.username || user?.email?.split("@")[0] || "user"}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[#3d654c]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#3d654c] dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              {privacy.account === "private" ? "Private" : "Public"}
            </span>
            <ChevronRight size={16} className="shrink-0 text-[#1c1d1a]/35 dark:text-neutral-500" />
          </button>
        </SettingsSection>
      </section>

      {SETTINGS_GROUPS.map((group) => {
        const categories = SETTINGS_CATEGORIES.filter((cat) => cat.group === group.key);
        if (!categories.length) return null;
        return (
          <section key={group.key} className="w-full">
            <SectionTitle title={group.label} />
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
          </section>
        );
      })}

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