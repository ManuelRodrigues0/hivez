/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AtSign, CalendarDays, KeyRound, Lock, Mail, Phone, ShieldCheck, User } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import {
  normalizePrivacy,
  saveUserPrivacySettings,
  type UserPrivacySettings,
} from "@/services/privacy";
import { NavRow, SectionTitle, SettingsSection } from "./settingsUi";

export default function AccountSettings() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [privacy, setPrivacy] = useState<UserPrivacySettings>(() => normalizePrivacy(profile));
  const [savingKey, setSavingKey] = useState("");

  useEffect(() => {
    setPrivacy(normalizePrivacy(profile));
  }, [profile]);

  async function updateAccount(next: UserPrivacySettings) {
    if (!user) return;
    setPrivacy(next);
    setSavingKey("account-privacy");
    try {
      await saveUserPrivacySettings(user.uid, next);
    } finally {
      setSavingKey("");
    }
  }

  const joinDate = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString([], {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "â€”";

  return (
    <>
      <SectionTitle title="Profile" />
      <SettingsSection>
        <NavRow
          icon={User}
          title="Personal information"
          subtitle="Update your display name and profile photo"
          onClick={() => navigate("/profile/edit")}
        />
        <NavRow
          icon={AtSign}
          title="Username"
          subtitle={profile?.username ? `@${profile.username}` : "Set a username"}
          onClick={() => navigate("/profile/edit")}
        />
      </SettingsSection>

      <SectionTitle title="Contact & credentials" />
      <SettingsSection>
        <div className="flex w-full items-center gap-3.5 border-b border-[#1c1d1a]/5 py-3.5 last:border-b-0 dark:border-neutral-800/60">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-[#f2c14e]">
            <Mail size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">Email</p>
            <p className="mt-0.5 truncate text-[11px] font-medium leading-4 text-[#1c1d1a]/55 dark:text-neutral-400">
              {user?.email || "â€”"} Â· managed by your sign-in provider
            </p>
          </div>
        </div>
        <div className="flex w-full items-center gap-3.5 border-b border-[#1c1d1a]/5 py-3.5 last:border-b-0 dark:border-neutral-800/60">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-[#f2c14e]">
            <Phone size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">Phone</p>
            <p className="mt-0.5 truncate text-[11px] font-medium leading-4 text-[#1c1d1a]/55 dark:text-neutral-400">
              {user?.phoneNumber || "Not yet linked"}
            </p>
          </div>
          <span className="rounded-full bg-[#1c1d1a]/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#1c1d1a]/45 dark:bg-white/10 dark:text-neutral-400">
            Unavailable
          </span>
        </div>
        <div className="flex w-full items-center gap-3.5 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-[#f2c14e]">
            <KeyRound size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">Password</p>
            <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#1c1d1a]/55 dark:text-neutral-400">
              Password changes require reauthentication and are not available yet.
            </p>
          </div>
          <span className="rounded-full bg-[#1c1d1a]/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#1c1d1a]/45 dark:bg-white/10 dark:text-neutral-400">
            Unavailable
          </span>
        </div>
      </SettingsSection>
<SectionTitle title="Account status" />
      <SettingsSection>
        <div className="flex w-full items-center gap-3.5 border-b border-[#1c1d1a]/5 py-3.5 last:border-b-0 dark:border-neutral-800/60">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-[#f2c14e]">
            <ShieldCheck size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">Account status</p>
            <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#1c1d1a]/55 dark:text-neutral-400">
              Your Hivez account is healthy and active.
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Active
          </span>
        </div>
        <div className="flex w-full items-center gap-3.5 py-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-[#f2c14e]">
            <CalendarDays size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">Join date</p>
            <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#1c1d1a]/55 dark:text-neutral-400">
              {joinDate}
            </p>
          </div>
        </div>
      </SettingsSection>

      <SectionTitle title="Account privacy" />
      <SettingsSection>
        <div className="flex w-full flex-col gap-3 border-b border-[#1c1d1a]/5 py-3.5 last:border-b-0 dark:border-neutral-800/60 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-[#f2c14e]">
              <Lock size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">Public / Private account</p>
              <p className="mt-0.5 text-[11px] font-medium leading-4 text-[#1c1d1a]/55 dark:text-neutral-400">
                Private accounts require approval before protected posts and ReHives are visible.
              </p>
            </div>
          </div>
          <div className="grid w-full max-w-[220px] shrink-0 grid-cols-2 rounded-xl bg-[#f7f7f2] p-1 dark:bg-[#1a1a1a]">
            {(["public", "private"] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={savingKey === "account-privacy"}
                onClick={() =>
                  updateAccount({
                    ...privacy,
                    account: value,
                    messages:
                      value === "private" && privacy.messages === "everyone" ? "followers" : privacy.messages,
                  })
                }
                className={`rounded-lg px-3 py-1.5 text-xs font-black capitalize transition ${
                  privacy.account === value
                    ? "bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]"
                    : "text-[#1c1d1a]/60 dark:text-neutral-400"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      </SettingsSection>
    </>
  );
}