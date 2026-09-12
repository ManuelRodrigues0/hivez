import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { normalizePrivacy } from "@/services/privacy";
import { SETTINGS_CATEGORIES } from "./settingsNav";

/**
 * Settings layout:
 *  - Desktop: sticky category rail (left) + active category content (right).
 *  - Mobile:  header + content; the hub (/settings) is the drill-down list.
 */
export default function SettingsLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const privacy = normalizePrivacy(profile);
  const isRoot = location.pathname === "/settings";

  const activeCategory = [...SETTINGS_CATEGORIES]
    .reverse()
    .find(
      (cat) =>
        !cat.external &&
        (location.pathname === cat.path || location.pathname.startsWith(`${cat.path}/`))
    );

  return (
    <div className="app-settings-page w-full min-h-screen select-none">
      <div className="mb-4 flex items-center gap-3 lg:mb-6">
        {!isRoot && (
          <button
            type="button"
            onClick={() => navigate("/settings")}
            aria-label="Back to settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-white text-[#1c1d1a] shadow-2xs transition hover:bg-[#ecece5] dark:border-neutral-800 dark:bg-[#141414] dark:text-white dark:hover:bg-neutral-800"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-lg font-black tracking-tight text-[#1c1d1a] dark:text-white">
            {isRoot ? "Settings" : activeCategory?.label || "Settings"}
          </h1>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#3d654c] dark:text-[#f2c14e]">
            {privacy.account === "private" ? "Private account" : "Public account"}
          </p>
        </div>
      </div>

      <div className="flex items-start gap-5">
        {/* Desktop category rail */}
        <nav aria-label="Settings categories" className="hidden w-52 shrink-0 lg:block">
          <ul className="sticky top-20 space-y-0.5">
            {SETTINGS_CATEGORIES.map((cat) => (
              <li key={cat.key}>
                <NavLink
                  to={cat.path}
                  className={({ isActive: active }) =>
                    `flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-bold transition ${
                      cat.external
                        ? location.pathname === cat.path
                          ? "bg-[#3d654c]/10 text-[#3d654c] dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]"
                          : "text-[#1c1d1a]/65 hover:bg-[#1c1d1a]/5 hover:text-[#1c1d1a] dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white"
                        : active
                          ? "bg-[#3d654c]/10 text-[#3d654c] dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]"
                          : "text-[#1c1d1a]/65 hover:bg-[#1c1d1a]/5 hover:text-[#1c1d1a] dark:text-neutral-400 dark:hover:bg-white/5 dark:hover:text-white"
                    }`
                  }
                >
                  <cat.icon size={16} className="shrink-0" />
                  <span className="truncate">{cat.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Active category content */}
        <div className="min-w-0 flex-1 space-y-6 pb-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}