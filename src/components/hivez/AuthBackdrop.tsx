import { type ReactNode } from "react";

export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="hivez-auth-page relative min-h-dvh overflow-hidden bg-[#f7f7f2] font-sans text-foreground">
      <div className="relative z-10">{children}</div>
    </div>
  );
}