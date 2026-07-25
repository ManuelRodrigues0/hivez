import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Search, PlusSquare, Heart, User, Menu, Compass } from "lucide-react";

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Search, label: "Search", path: "/search" },
    { icon: Compass, label: "Explore", path: "/explore" },
    { icon: PlusSquare, label: "Create", path: "/camera" },
    { icon: Heart, label: "Activity", path: "/activity" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <div className="mx-auto flex min-h-screen bg-white text-black dark:bg-black dark:text-white">
      {/* Desktop Sidebar (left) - Instagram/Threads style */}
      <aside className="hidden border-r border-zinc-200 dark:border-zinc-800 lg:flex lg:w-[72px] xl:w-[244px] flex-col fixed left-0 top-0 h-screen py-4 bg-white dark:bg-black z-50">
        <div className="mb-6 px-4">
          <h1 className="text-xl font-bold tracking-tight xl:block hidden">🐝 HIVEZ</h1>
          <h1 className="text-xl font-bold tracking-tight xl:hidden block text-center">🐝</h1>
        </div>

        <nav className="flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-4 rounded-xl px-3 py-3 transition ${
                  active
                    ? "font-semibold bg-zinc-100 dark:bg-zinc-900"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                <Icon size={24} className={active ? "text-black dark:text-white" : "text-zinc-600 dark:text-zinc-400"} />
                <span className="hidden xl:block text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-2">
          <button
            onClick={() => navigate("/settings")}
            className="flex w-full items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <Menu size={24} className="text-zinc-600 dark:text-zinc-400" />
            <span className="hidden xl:block text-sm">More</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex w-full flex-col lg:ml-[72px] xl:ml-[244px]">
        {/* Mobile Top Bar */}
        <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-black/95 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Menu size={22} />
            </button>

            <h1 className="text-lg font-bold tracking-wide">🐝 HIVEZ</h1>

            <button
              onClick={() => navigate("/search")}
              className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Search size={22} />
            </button>
          </div>
        </header>

        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed left-0 top-0 z-50 h-full w-64 border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-black lg:hidden">
              <div className="mb-6">
                <h1 className="text-xl font-bold">🐝 HIVEZ</h1>
              </div>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                      className={`flex items-center gap-4 rounded-xl px-3 py-3 transition ${
                        active
                          ? "font-semibold bg-zinc-100 dark:bg-zinc-900"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <Icon size={22} />
                      <span className="text-sm">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 max-w-2xl mx-auto w-full">
          <Outlet />
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black lg:hidden">
          <div className="flex items-center justify-around py-2">
            <button onClick={() => navigate("/")} className="flex flex-col items-center gap-0.5 px-3 py-1">
              <Home size={22} className={isActive("/") ? "text-black dark:text-white" : "text-zinc-500"} />
            </button>
            <button onClick={() => navigate("/search")} className="flex flex-col items-center gap-0.5 px-3 py-1">
              <Search size={22} className={isActive("/search") ? "text-black dark:text-white" : "text-zinc-500"} />
            </button>
            <button onClick={() => navigate("/camera")} className="flex flex-col items-center gap-0.5 px-3 py-1">
              <div className="rounded-full border-2 border-zinc-500 p-1">
                <PlusSquare size={18} className="text-zinc-500" />
              </div>
            </button>
            <button onClick={() => navigate("/activity")} className="flex flex-col items-center gap-0.5 px-3 py-1">
              <Heart size={22} className={isActive("/activity") ? "text-black dark:text-white" : "text-zinc-500"} />
            </button>
            <button onClick={() => navigate("/profile")} className="flex flex-col items-center gap-0.5 px-3 py-1">
              <User size={22} className={isActive("/profile") ? "text-black dark:text-white" : "text-zinc-500"} />
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}