import { useState } from "react";
import { Database, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PlannedRow, SectionTitle, SettingsSection, SettingRow } from "./settingsUi";

export default function DataSettings() {
  const [clearing, setClearing] = useState(false);

  async function handleClearCache() {
    setClearing(true);
    try {
      // Clears only on-device caches. Firebase Auth persists in IndexedDB and
      // the stored theme preference is restored; nothing in Firestore is touched.
      const themeKey = localStorage.getItem("hivez-theme");
      localStorage.clear();
      if (themeKey) {
        try {
          localStorage.setItem("hivez-theme", themeKey);
        } catch {
          /* ignore quota errors */
        }
      }
      const storage = (navigator as Navigator & { storage?: { clear?: () => Promise<void> } }).storage;
      if (storage?.clear) {
        await storage.clear().catch(() => undefined);
      }
      toast.success("On-device cache cleared");
    } catch (error) {
      console.error("Failed to clear cache:", error);
      toast.error("Could not clear cache. Please try again.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <>
      <SectionTitle title="Your data" />
      <SettingsSection>
        <PlannedRow
          icon={Download}
          title="Download data"
          subtitle="Get an export of your posts, activity and settings."
          note="Coming soon"
        />
        <PlannedRow
          icon={Database}
          title="Data usage"
          subtitle="See storage used by photos, videos and drafts on this device."
          note="Coming soon"
        />
        <SettingRow
          icon={Trash2}
          title="Clear cache"
          subtitle="Clears photos, drafts and other on-device caches. Your posts and data in Firestore stay untouched."
        >
          <button
            type="button"
            onClick={() => void handleClearCache()}
            disabled={clearing}
            className="rounded-xl bg-[#1c1d1a]/5 px-3.5 py-2 text-xs font-bold text-[#1c1d1a] transition hover:bg-[#1c1d1a]/10 disabled:opacity-50 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            {clearing ? "Clearing..." : "Clear cache"}
          </button>
        </SettingRow>
      </SettingsSection>
    </>
  );
}