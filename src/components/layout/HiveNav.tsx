import { NavLink } from "react-router-dom";
import {
  Bell,
  Bookmark,
  HandHeart,
  Home,
  Map,
  MessageCircle,
  Search,
  Settings,
  User,
  LogOut,
  ArrowUpRight,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { COMMUNITIES } from "@/constants/communities";
import HiveSearch from "@/components/hiveSearch/HiveSearch";

const workspaceLinks: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/", label: "Your feed", icon: Home },
  { to: "/search", label: "Explore", icon: Search },
  { to: "/volunteering", label: "Lend a hand", icon: HandHeart },
  { to: "/map", label: "Neighbourhood map", icon: Map },
  { to: "/chats", label: "Messages", icon: MessageCircle },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/saved", label: "Saved posts", icon: Bookmark },
  { to: "/profile", label: "Your profile", icon: User },
];

export default function HiveNav({
  collapsed,
  unread,
  onNavigate,
  onClose,
  onLogout,
  onCreate,
}: {
  collapsed: boolean;
  unread: number;
  onNavigate: (path: string) => void;
  onClose: () => void;
  onLogout: () => void;
  onCreate: () => void;
}) {
  return (
    <div className={`hv-navigation ${collapsed ? "is-compact" : ""}`}>
      <nav aria-label="Main navigation" className="hv-nav-links">
        {workspaceLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/" || to === "/profile"}
            title={collapsed ? label : undefined}
            aria-label={label}
            onClick={onClose}
            className={({ isActive }) =>
              `hv-nav-link ${isActive ? "is-active" : ""}`
            }
          >
            <Icon size={19} strokeWidth={1.65} aria-hidden="true" />
            <span>{label}</span>
            {to === "/notifications" && unread > 0 && (
              <b className="hv-count">{unread > 99 ? "99+" : unread}</b>
            )}
          </NavLink>
        ))}
      </nav>
      {!collapsed && (
        <div className="hv-rail-hives">
          <div className="hv-rail-section-title">
            <p className="hv-rail-label">FIND YOUR HIVE</p>
            <ArrowUpRight size={14} aria-hidden="true" />
          </div>
          <HiveSearch
            onSelect={(id) => onNavigate(`/hive/${id}`)}
            placeholder="Find a hive"
            maxResults={4}
            showSuggestions={false}
          />
          <div className="hv-hive-links">
            {COMMUNITIES.slice(0, 3).map((hive, i) => (
              <NavLink to={`/hive/${hive.id}`} onClick={onClose} key={hive.id}>
                <span
                  className={`hv-hive-dot hv-hive-dot--${i}`}
                  aria-hidden="true"
                />
                <span>{hive.name}</span>
                <ChevronRight size={13} aria-hidden="true" />
              </NavLink>
            ))}
          </div>
          <button className="hv-rail-invite" onClick={onCreate}>
            <span>
              Notice something?
              <br />
              <strong>Start a conversation.</strong>
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      <div className="hv-nav-bottom">
        <NavLink
          to="/settings"
          onClick={onClose}
          title={collapsed ? "Settings" : undefined}
          aria-label="Settings"
          className="hv-nav-link"
        >
          <Settings size={19} strokeWidth={1.65} aria-hidden="true" />
          <span>Settings</span>
        </NavLink>
        <button
          onClick={onLogout}
          className="hv-nav-link hv-logout"
          title={collapsed ? "Log out" : undefined}
          aria-label="Log out"
        >
          <LogOut size={19} strokeWidth={1.65} aria-hidden="true" />
          <span>Log out</span>
        </button>
        {!collapsed && (
          <p className="hv-rail-signoff">A little local. A lot possible.</p>
        )}
      </div>
    </div>
  );
}
