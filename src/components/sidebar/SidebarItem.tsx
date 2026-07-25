import { ChevronRight } from "lucide-react";

interface SidebarItemProps {
  icon: string;
  title: string;
  onClick: () => void;
}

export default function SidebarItem({
  icon,
  title,
  onClick,
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
    >
      <div className="flex items-center gap-4">
        <span className="text-2xl">{icon}</span>
        <span className="text-[15px] font-medium">{title}</span>
      </div>

      <ChevronRight size={18} className="text-zinc-400" />
    </button>
  );
}