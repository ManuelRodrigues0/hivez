import { Outlet } from "react-router-dom";

export default function MobileLayout() {
  return (
    <div className="app-shell min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-white">
      <Outlet />
    </div>
  );
}
