import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Menu, Pause, Play, X } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import PublicThemeToggle from "@/components/common/PublicThemeToggle";

const navItems = [
  { label: "The idea", href: "#discover" },
  { label: "How it works", href: "#how" },
  { label: "Find your hive", href: "#hives" },
];

export default function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const { reducedMotion, setReducedMotion } = useTheme();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) dialog.showModal();
    else if (dialog.open) dialog.close();
  }, [open]);

  const close = () => {
    setOpen(false);
    menuRef.current?.focus();
  };

  return (
    <header className="hz-nav">
      <Link to="/" className="hz-wordmark" aria-label="Hivez home">
        <span className="hz-hive-mark" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        hivez<span className="hz-wordmark-period">.</span>
      </Link>
      <nav className="hz-nav-links" aria-label="Primary">
        {navItems.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="hz-nav-actions">
        <button
          type="button"
          className="hz-icon-button hz-motion-toggle"
          onClick={() => setReducedMotion(!reducedMotion)}
          aria-label={reducedMotion ? "Enable animations" : "Pause animations"}
          title={reducedMotion ? "Enable animations" : "Pause animations"}
        >
          {reducedMotion ? <Play size={16} /> : <Pause size={16} />}
        </button>
        <PublicThemeToggle className="hz-icon-button" />
        <Link to="/login" className="hz-login">
          Log in
        </Link>
        <Link to="/signup" className="hz-button hz-button--small">
          Join the hive <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <button
          ref={menuRef}
          type="button"
          className="hz-icon-button hz-menu-toggle"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="hz-mobile-menu"
        >
          <Menu size={23} />
        </button>
      </div>
      <dialog
        ref={dialogRef}
        id="hz-mobile-menu"
        className="hz-mobile-menu"
        aria-label="Navigation"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls =
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button, a[href]",
            );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="hz-mobile-menu-inner">
          <div className="hz-mobile-menu-top">
            <span className="hz-wordmark">hivez.</span>
            <button
              type="button"
              className="hz-icon-button"
              onClick={close}
              aria-label="Close menu"
            >
              <X size={25} />
            </button>
          </div>
          <span className="hz-eyebrow">A little local. A lot possible.</span>
          <nav aria-label="Mobile navigation">
            {navItems.map((item, index) => (
              <a key={item.href} href={item.href} onClick={close}>
                <span>0{index + 1}</span>
                {item.label}
                <ArrowUpRight aria-hidden="true" />
              </a>
            ))}
          </nav>
          <Link to="/login" onClick={close} className="hz-text-link">
            Already here? Log in <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link to="/signup" onClick={close} className="hz-button">
            Join the hive <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
        </div>
      </dialog>
    </header>
  );
}
