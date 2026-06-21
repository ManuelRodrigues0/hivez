import { Search, Menu } from "lucide-react";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black/95 backdrop-blur">
      <div className="flex items-center justify-between px-5 py-4">

        <button className="text-white">
          <Menu size={24} />
        </button>

        <h1 className="text-3xl font-black tracking-wide">
          HIVEZ
        </h1>

        <button className="text-white">
          <Search size={24} />
        </button>

      </div>

      <div className="flex justify-center gap-10 pb-3 text-sm">

        <button className="text-zinc-500">
          Following
        </button>

        <button className="border-b-2 border-white pb-2 font-semibold">
          For You
        </button>

      </div>
    </header>
  );
}