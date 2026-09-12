import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";

export function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="px-1 text-[11px] font-black uppercase tracking-[0.2em] text-[#1c1d1a]/45 dark:text-neutral-500">
      {title}
    </h2>
  );
}

export function SettingsSection({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#1c1d1a]/10 bg-white p-4 shadow-xs dark:border-neutral-800/90 dark:bg-[#121212]">
      {children}
    </section>
  );
}

export function SettingRow({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-[#1c1d1a]/5 py-2.5 last:border-b-0 dark:border-neutral-800/60 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-[#f2c14e]">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold text-[#1c1d1a] dark:text-white">{title}</p>
          <p className="mt-0.5 truncate text-[11px] font-medium leading-4 text-[#1c1d1a]/55 dark:text-neutral-400">{subtitle}</p>
        </div>
      </div>
      <div className="sm:shrink-0">{children}</div>
    </div>
  );
}

export function OptionRow<T extends string>({
  icon,
  title,
  subtitle,
  options,
  value,
  onChange,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <SettingRow icon={icon} title={title} subtitle={subtitle}>
      <div className="grid min-w-[240px] grid-cols-2 gap-1 rounded-xl bg-[#f7f7f2] p-1 dark:bg-[#1a1a1a] sm:grid-cols-4">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-2 py-1.5 text-[11px] font-black transition ${
              value === option.value
                ? "bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]"
                : "text-[#1c1d1a]/60 dark:text-neutral-400"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </SettingRow>
  );
}

export function Switch({
  checked,
  disabled,
  onClick,
}: {
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${
        checked ? "bg-[#3d654c] dark:bg-[#f2c14e]" : "bg-neutral-200 dark:bg-neutral-800"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 dark:bg-[#121212] ${
          checked ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function PlannedRow({
  icon: Icon,
  title,
  subtitle,
  note = "Unavailable",
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  note?: string;
}) {
  return (
    <SettingRow icon={Icon} title={title} subtitle={subtitle}>
      <span className="rounded-full bg-[#1c1d1a]/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#1c1d1a]/45 dark:bg-white/10 dark:text-neutral-400">
        {note}
      </span>
    </SettingRow>
  );
}

export function NavRow({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-[#1c1d1a]/5 py-2.5 text-left transition last:border-b-0 hover:bg-[#f7f7f2]/70 focus-visible:ring-2 focus-visible:ring-[#3d654c]/40 focus-visible:ring-offset-1 dark:border-neutral-800/60 dark:hover:bg-white/5"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] dark:border-neutral-800 dark:bg-[#1a1a1a] dark:text-[#f2c14e]">
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[#1c1d1a] dark:text-white">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-[11px] font-medium leading-4 text-[#1c1d1a]/55 dark:text-neutral-400">{subtitle}</p>
        ) : null}
      </div>
      <ChevronRight size={16} className="shrink-0 text-[#1c1d1a]/35 dark:text-neutral-500" />
    </button>
  );
}