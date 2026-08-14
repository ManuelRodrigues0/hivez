import { useId, useState, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  invalid?: boolean;
};

export function AuthField({ label, invalid, className, ...props }: Props) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const filled = Boolean(props.value);
  const lifted = focused || filled;

  return (
    <div className="relative">
      <input
        id={id}
        {...props}
        placeholder=" "
        aria-invalid={invalid ?? false}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        className={[
          "field-glow peer w-full rounded-2xl border bg-muted px-4 pb-2.5 pt-6 text-[0.95rem] text-foreground",
          invalid ? "border-destructive/70" : "border-border",
          className ?? "",
        ].join(" ")}
      />
      <label
        htmlFor={id}
        className={[
          "pointer-events-none absolute left-4 origin-left text-muted-foreground transition-all duration-200 ease-out",
          lifted ? "top-2 text-[0.7rem] tracking-wide" : "top-1/2 -translate-y-1/2 text-sm",
          focused ? "text-primary" : "",
        ].join(" ")}
      >
        {label}
      </label>
    </div>
  );
}
