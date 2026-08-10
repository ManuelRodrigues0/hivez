import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

const navItems = [
  { label: "Discover", href: "#discover" },
  { label: "Nearby", href: "#nearby" },
  { label: "Hives", href: "#hives" },
];

export default function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav className={`landing-nav ${scrolled ? "is-scrolled" : ""}`} aria-label="Primary">
        <div className="landing-nav__shell">
          <Link to="/" className="landing-wordmark" aria-label="HIVEZ home">
            <span className="landing-wordmark__mark" aria-hidden="true" />
            HIVEZ
          </Link>

          <div className="landing-nav__links" aria-label="Landing sections">
            {navItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </div>

          <div className="landing-nav__actions">
            <Link to="/login" className="landing-nav__login">
              Log in
            </Link>
            <Link to="/signup" className="landing-nav__signup">
              Sign up
            </Link>
          </div>

          <button
            type="button"
            className="landing-menu-button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </nav>

      <div className={`landing-mobile-menu ${menuOpen ? "is-open" : ""}`} aria-hidden={!menuOpen}>
        <button
          type="button"
          className="landing-mobile-menu__close"
          onClick={closeMenu}
          aria-label="Close menu"
        >
          <X size={24} aria-hidden="true" />
        </button>

        <Link to="/" className="landing-mobile-menu__brand" onClick={closeMenu}>
          HIVEZ
        </Link>

        <div className="landing-mobile-menu__links">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} onClick={closeMenu}>
              {item.label}
            </a>
          ))}
        </div>

        <div className="landing-mobile-menu__actions">
          <Link to="/login" onClick={closeMenu}>
            Login
          </Link>
          <Link to="/signup" onClick={closeMenu}>
            Sign up
          </Link>
        </div>
      </div>
    </>
  );
}
