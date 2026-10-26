import type { ReactNode } from "react";

export default function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="hv-page-intro">
      <div>
        <p className="hv-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p className="hv-intro-copy">{description}</p>}
      </div>
      {action && <div className="hv-intro-action">{action}</div>}
    </header>
  );
}
