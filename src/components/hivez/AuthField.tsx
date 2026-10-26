import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  onReveal?: () => void;
};
export function AuthField({
  label,
  error,
  hint,
  onReveal,
  className,
  ...props
}: Props) {
  const generated = useId();
  const id = props.id || generated;
  const [revealed, setRevealed] = useState(false);
  const password = props.type === "password";
  const description = [
    props["aria-describedby"],
    (error || hint) && `${id}-help`,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      className={`ha-field ${error ? "ha-field--invalid" : ""} ${className || ""}`}
    >
      <label htmlFor={id}>{label}</label>
      <div className="ha-input-wrap">
        <input
          {...props}
          id={id}
          type={password && revealed ? "text" : props.type}
          aria-invalid={Boolean(error)}
          aria-describedby={description || undefined}
        />
        {password && (
          <button
            type="button"
            className="ha-reveal"
            aria-label={`${revealed ? "Hide" : "Show"} ${label.toLowerCase()}`}
            aria-pressed={revealed}
            disabled={props.disabled}
            onClick={() => {
              setRevealed(!revealed);
              onReveal?.();
            }}
          >
            {revealed ? (
              <EyeOff size={18} aria-hidden="true" />
            ) : (
              <Eye size={18} aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {(error || hint) && (
        <p
          id={`${id}-help`}
          className={error ? "ha-field-error" : "ha-field-hint"}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
