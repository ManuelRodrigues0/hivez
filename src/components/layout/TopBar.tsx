import { Menu, Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const getTitle = () => {
    if (location.pathname === "/") return "HIVEZ";

    if (location.pathname.startsWith("/hive/")) {
      const hive = location.pathname.split("/")[2];
      return hive
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    if (location.pathname === "/profile") return "Profile";
    if (location.pathname === "/activity") return "Activity";
    if (location.pathname === "/notifications") return "Notifications";
    if (location.pathname === "/settings") return "Settings";
    if (location.pathname === "/search") return "Search";

    return "HIVEZ";
  };

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-black/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onMenuClick}
          className="rounded-full p-2 transition hover:bg-zinc-800"
        >
          <Menu size={22} />
        </button>

        <h1 className="text-lg font-bold tracking-wide">
          🐝 {getTitle()}
        </h1>

        <button
          onClick={() => navigate("/search")}
          className="rounded-full p-2 transition hover:bg-zinc-800"
        >
          <Search size={22} />
        </button>
      </div>
    </header>
  );
}