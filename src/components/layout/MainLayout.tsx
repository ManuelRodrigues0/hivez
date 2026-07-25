import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Search, PlusSquare, Heart, User, Menu, X, Settings, LogOut } from "lucide-react";
import { COMMUNITIES } from "../../constants/communities";
import { logout } from "../../services/auth";

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  function go(path: string) {
    navigate(path);
    setSidebarOpen(false);
  }

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-5 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-black tracking-wide">🐝 HIVEZ</h1>
          <p className="text-xs text-zinc-500">Report. React. Resolve.</p>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <X size={22} />
        </button>
      </div>

      {/* Home */}
      <button
        onClick={() => go("/")}
        className={`flex items-center gap-4 px-5 py-4 transition ${
          isActive("/") ? "bg-zinc-100 font-semibold dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
        }`}
      >
        <Home size={22} /> Home
      </button>

      {/* Communities */}
      <div className="px-5 pt-6 pb-3 text-xs uppercase tracking-widest text-zinc-500">Hives</div>
      <div className="flex-1 overflow-y-auto">
        {COMMUNITIES.map((community) => (
          <button
            key={community.id}
            onClick={() => go(`/hive/${community.id}`)}
            className={`flex w-full items-center gap-4 px-5 py-3.5 text-sm transition ${
              isActive(`/hive/${community.id}`) ? "bg-zinc-100 font-semibold dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            <span className="text-lg">{community.icon}</span>
            <span>{community.name}</span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <button onClick={() => go("/settings")} className="flex w-full items-center gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900">
          <Settings size={20} /> Settings
        </button>
        <button
          onClick={logout}
          className="flex w-full items-center gap-4 px-5 py-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <LogOut size={20} /> Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-white text-black dark:bg-black dark:text-white">
      {/* Desktop Sidebar - Icon only (Twitter/Threads style) */}
      <aside className="hidden lg:flex lg:w-[72px] xl:w-[280px] lg:flex-col lg:border-r lg:border-zinc-200 lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:bg-white dark:lg:border-zinc-800 dark:lg:bg-black">
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <div className="flex w-full flex-col lg:ml-[72px] xl:ml-[280px]">
        {/* Mobile Top Bar */}
        <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-black/95 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Menu size={22} />
            </button>
            <h1 className="text-lg font-bold tracking-wide">🐝 HIVEZ</h1>
            <button onClick={() => navigate("/search")} className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Search size={22} />
            </button>
          </div>
        </header>

        {/* Mobile Sidebar */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <div className="fixed left-0 top-0 z-50 flex h-screen w-80 max-w-[85%] flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:hidden">
              {sidebarContent}
            </div>
          </>
        )}

        {/* Page Content - constrained width on desktop */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          <div className="mx-auto max-w-2xl">
            <Outlet />
          </div>
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