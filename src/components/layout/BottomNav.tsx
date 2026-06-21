import {
  House,
  Search,
  SquarePlus,
  Heart,
  User,
} from "lucide-react";

import { NavLink, useNavigate } from "react-router-dom";

export default function BottomNav() {
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-1/2 z-50 flex w-full max-w-md -translate-x-1/2 items-center justify-around border-t border-zinc-800 bg-black py-3">

      <NavLink to="/">
        <House size={24} />
      </NavLink>

      <NavLink to="/search">
        <Search size={24} />
      </NavLink>

      <button
        onClick={() => navigate("/camera")}
      >
        <SquarePlus size={24} />
      </button>

      <NavLink to="/activity">
        <Heart size={24} />
      </NavLink>

      <NavLink to="/profile">
        <User size={24} />
      </NavLink>

    </nav>
  );
}