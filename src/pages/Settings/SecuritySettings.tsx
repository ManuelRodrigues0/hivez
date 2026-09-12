import { Fingerprint, Laptop, Lock, ShieldCheck } from "lucide-react";

import { PlannedRow, SectionTitle, SettingsSection } from "./settingsUi";

/**
 * Security section. Hivez relies on Firebase Auth for identity; the richer
 * account-security features below are not wired to any provider yet, so they
 * are honestly flagged "Not available yet" instead of being faked.
 */
export default function SecuritySettings() {
  return (
    <>
      <SectionTitle title="Security" />
      <SettingsSection>
        <PlannedRow
          icon={Lock}
          title="Two-factor authentication"
          subtitle="Add a second verification step when you sign in."
          note="Coming soon"
        />
        <PlannedRow icon={Fingerprint} title="Passkeys" subtitle="Sign in with a passkey or your device." note="Not available yet" />
        <PlannedRow icon={Laptop} title="Devices" subtitle="Review and manage devices signed in to your account." note="Not available yet" />
        <PlannedRow icon={ShieldCheck} title="Login activity" subtitle="Review recent sign-ins to your account." note="Not available yet" />
      </SettingsSection>
    </>
  );
}