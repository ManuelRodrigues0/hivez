import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Camera, Check, Moon, Sun, Type } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import bee from "@/assets/auth/newbee2.png";
import "@/styles/composer.css";

export function ComposerHeader({ label, onBack, children }: { label: string; onBack: () => void; children?: ReactNode }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  return <header className="dispatch-header">
    <div className="dispatch-header-left">
      <button type="button" className="dispatch-icon" onClick={onBack} aria-label="Back to previous step"><ArrowLeft size={20} /></button>
      <Link to="/" className="dispatch-brand" aria-label="Hivez home">hivez.<img src={bee} alt="" width="80" height="70" /></Link>
    </div>
    <span className="dispatch-header-label">{label}</span>
    <div className="dispatch-header-right">
      <button type="button" className="dispatch-icon" onClick={toggleTheme} aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}>{resolvedTheme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button>
      {children || <Link to="/" className="dispatch-cancel">Close<span aria-hidden="true"> ×</span></Link>}
    </div>
  </header>;
}

export function CreateChoices({ onReport, onText, compact = false }: { onReport: () => void; onText: () => void; compact?: boolean }) {
  return <div className={`dispatch-choices ${compact ? "is-compact" : ""}`}>
    <button type="button" className="dispatch-choice" onClick={onReport}>
      <span className="dispatch-choice-index">01 / SEE SOMETHING</span>
      <Camera className="dispatch-choice-symbol" size={32} strokeWidth={1.5} aria-hidden="true" />
      <h2>Bring it<br /><em>into view.</em></h2>
      <p>A photo, a place, a little context.<br />Help your neighbours see what needs a hand.</p>
      <span className="dispatch-choice-link">Create a photo report <ArrowUpRight size={22} /></span>
    </button>
    <button type="button" className="dispatch-choice" onClick={onText}>
      <span className="dispatch-choice-index">02 / SAY SOMETHING</span>
      <Type className="dispatch-choice-symbol" size={32} strokeWidth={1.5} aria-hidden="true" />
      <h2>Put a thought<br /><em>out there.</em></h2>
      <p>A question, an idea, some good news.<br />Every conversation starts with a few words.</p>
      <span className="dispatch-choice-link">Write a post <ArrowUpRight size={22} /></span>
    </button>
  </div>;
}

export function DispatchIdentity({ name, username, photoURL, visibility }: { name: string; username: string; photoURL?: string; visibility: string }) {
  return <div className="dispatch-identity">
    {photoURL ? <img src={photoURL} alt="" width="44" height="44" /> : <span className="dispatch-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
    <div><strong>{name}</strong><span>@{username}</span></div>
    <span className="dispatch-audience">{visibility === "public" ? "Public post" : "Followers only"}</span>
  </div>;
}

export function DispatchChecklist({ items }: { items: { label: string; complete: boolean }[] }) {
  return <ul className="dispatch-checklist">{items.map(item => <li key={item.label} className={item.complete ? "is-complete" : ""}><span aria-hidden="true">{item.complete ? <Check size={12} /> : <span className="dispatch-check-dot" />}</span>{item.label}</li>)}</ul>;
}

export function DispatchFooter({ children }: { children: ReactNode }) {
  return <footer className="dispatch-footer"><span>Small acts. Big local change.</span><span>{children}</span></footer>;
}
