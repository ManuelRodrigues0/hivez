import { useState } from "react";
import { Outlet } from "react-router-dom";

import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import Sidebar from "../sidebar/Sidebar";

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="mx-auto flex min-h-screen max-w-md bg-black text-white">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="relative flex min-h-screen w-full flex-col">
        <TopBar
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto pb-20">
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </div>
  );
}