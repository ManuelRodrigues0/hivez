import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { normalizePrivacy } from "@/services/privacy";
import { SETTINGS_CATEGORIES } from "./settingsNav";

/**
 * Settings layout (strict drill-down):
 *  - /settings renders ONLY the top-level category list (Settings hub).
 *  - A category route renders ONLY that category — the parent list is fully
 *    replaced, never shown beside it, on desktop and mobile alike.
 *  - Navigation is route-based, so browser Back/Forward, refresh and deep
 *    links all work; the in-page back button mirrors browser Back to /settings.
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

      <div className="mx-auto w-full max-w-3xl space-y-6 pb-8">
        <Outlet />
      </div>
    </div>
  );
}