import React from "react";
import { ChevronRight } from "lucide-react";

interface SidebarItemProps {
  icon: string | React.ReactNode;
  title: string;
  onClick: () => void;
  isActive?: boolean;
}

export default function SidebarItem({
  icon,
  title,
  onClick,
  isActive = false,
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-all duration-200 ${
        isActive
          ? "bg-[#3d654c] text-white shadow-md shadow-[#3d654c]/20"
          : "text-[#1c1d1a]/85 hover:bg-[#1c1d1a]/5 hover:text-[#1c1d1a]"
      }`}
    >
      <div className="flex items-center gap-3.5">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition-transform duration-200 group-hover:scale-110 ${
            isActive
              ? "bg-white/15 text-white"
              : "bg-white border border-[#1c1d1a]/10 shadow-sm"
          }`}
        >
          {icon}
        </span>
        <span
          className={`text-sm font-bold tracking-tight ${
            isActive ? "text-white" : "text-[#1c1d1a]"
          }`}
        >
          {title}
        </span>
      </div>

      <ChevronRight
        size={16}
        className={`transition-all duration-200 ${
          isActive
            ? "text-white opacity-90 translate-x-0.5"
            : "text-[#1c1d1a]/40 opacity-0 group-hover:opacity-100 group-hover:translate-x-1"
        }`}
      />
    </button>
  );
}