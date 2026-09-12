import { useState } from "react";
import { AlertTriangle, LogOut, Trash2 } from "lucide-react";

import { logout } from "@/services/auth";
import { SectionTitle, SettingsSection } from "./settingsUi";

export default function DeleteAccountSettings() {
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
    <>
      <SectionTitle title="Deactivate or delete account" />
      <SettingsSection>
        <div className="flex items-start gap-3.5 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 space-y-1 text-[12px] leading-5">
            <p className="font-bold">This area controls the future of your Hivez account.</p>
            <p>
              Deactivation and permanent deletion are not available in-app yet. If you need to close your
              account, contact Hivez support with your username. Nothing will be deleted unless you confirm it.
            </p>
          </div>
        </div>

        {confirming ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/40 dark:bg-rose-950/20">
            <p className="text-xs font-bold text-rose-700 dark:text-rose-400">Sign out and continue later?</p>
            <p className="mt-1 text-[11px] text-rose-700/80 dark:text-rose-400/80">
              Account deletion is not automatic. You will be signed out only; your data stays in Hivez.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-xl border border-[#1c1d1a]/10 bg-white px-3.5 py-2 text-xs font-bold text-[#1c1d1a] transition hover:bg-[#ecece5] disabled:opacity-50 dark:border-neutral-800 dark:bg-[#141414] dark:text-white dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={loggingOut}
                className="rounded-xl bg-[#1c1d1a] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#32533e] disabled:opacity-50 dark:bg-[#f2c14e] dark:text-[#121212]"
              >
                {loggingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <LogOut size={15} />
              Deactivate account
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <Trash2 size={15} />
              Delete account
            </button>
          </div>
        )}
      </SettingsSection>
    </>
  );
}