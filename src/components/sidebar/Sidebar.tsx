import { X, Home, Settings, LogOut } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import SidebarItem from "./SidebarItem";
import { COMMUNITIES } from "../../constants/communities";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  function go(path: string) {
    navigate(path);
    onClose();
  }

  return (
    <>
      {/* Overlay */}

      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/70 transition-all duration-300 ${
          isOpen
            ? "opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer */}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-80 max-w-[85%] flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-transform duration-300 ${
          isOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* Header */}

        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-5 py-5">

          <div>

            <h1 className="text-2xl font-black tracking-wide text-zinc-900 dark:text-white">
              🐝 HIVEZ
            </h1>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Report. React. Resolve.
            </p>

          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X size={22} className="text-zinc-900 dark:text-white" />
          </button>

        </div>

        {/* Home */}

        <button
          onClick={() => go("/")}
          className={`flex items-center gap-4 px-5 py-4 transition ${
            location.pathname === "/"
              ? "bg-zinc-100 font-semibold dark:bg-zinc-800"
              : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
          }`}
        >
          <Home size={22} className="text-zinc-900 dark:text-white" />

          <span className="text-zinc-900 dark:text-white">Home</span>
        </button>

        {/* Communities */}

        <div className="px-5 pt-6 pb-3 text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          Hives
        </div>

        <div className="flex-1 overflow-y-auto">

          {COMMUNITIES.map((community) => (

            <div
              key={community.id}
              className={
                location.pathname ===
                `/hive/${community.id}`
                  ? "bg-zinc-100 dark:bg-zinc-800"
                  : ""
              }
            >
              <SidebarItem
                icon={community.icon}
                title={community.name}
                onClick={() =>
                  go(`/hive/${community.id}`)
                }
              />
            </div>

          ))}

        </div>

        {/* Footer */}

        <div className="border-t border-zinc-200 dark:border-zinc-800">

          <button
            onClick={() => go("/settings")}
            className="flex w-full items-center gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <Settings size={20} className="text-zinc-900 dark:text-white" />

            <span className="text-zinc-900 dark:text-white">Settings</span>
          </button>

          <button
            className="flex w-full items-center gap-4 px-5 py-4 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <LogOut size={20} />

            <span className="text-zinc-900 dark:text-white">Logout</span>
          </button>

        </div>

      </aside>
    </>
  );
}