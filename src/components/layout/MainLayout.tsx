import { useState, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, Search, PlusSquare, Heart, User, Menu, X, Settings, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { COMMUNITIES } from "../../constants/communities";
import { logout } from "../../services/auth";

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isActive = (path: string) => location.pathname === path;

  function go(path: string) {
    navigate(path);
    setSidebarOpen(false);
  }

  const sidebarContent = (
    <>
      {/* Home */}
      <button
        onClick={() => go("/")}
        className={`flex items-center gap-4 px-5 py-4 transition ${
          isActive("/") ? "bg-zinc-100 font-semibold dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
        }`}
      >
        <Home size={22} className="text-zinc-900 dark:text-white flex-shrink-0" /> 
        <span className="text-zinc-900 dark:text-white">Home</span>
      </button>

      {/* Communities */}
      <div className="px-5 pt-6 pb-3 text-xs uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Hives</div>
      <div className="flex-1 overflow-y-auto">
        {COMMUNITIES.map((community) => (
          <button
            key={community.id}
            onClick={() => go(`/hive/${community.id}`)}
            className={`flex w-full items-center gap-4 px-5 py-3.5 text-sm transition ${
              isActive(`/hive/${community.id}`) ? "bg-zinc-100 font-semibold dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
            }`}
          >
            <span className="text-lg flex-shrink-0">{community.icon}</span>
            <span className="text-zinc-900 dark:text-white truncate">{community.name}</span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <button onClick={() => go("/settings")} className="flex w-full items-center gap-4 px-5 py-4 hover:bg-zinc-50 dark:hover:bg-zinc-900">
          <Settings size={20} className="text-zinc-900 dark:text-white flex-shrink-0" /> 
          <span className="text-zinc-900 dark:text-white">Settings</span>
        </button>
        <button
          onClick={logout}
          className="flex w-full items-center gap-4 px-5 py-4 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <LogOut size={20} className="flex-shrink-0" /> 
          <span className="text-zinc-900 dark:text-white">Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen pt-16 pt-16 bg-white dark:bg-black text-zinc-900 dark:text-white">
      {/* Desktop Header - Fixed at top */}
      <header className="hidden lg:fixed lg:top-0 lg:left-0 lg:right-0 lg:z-50 lg:flex lg:items-center lg:justify-between lg:border-b lg:border-zinc-200 dark:lg:border-zinc-800 lg:bg-white dark:lg:bg-black lg:px-4 lg:h-16">
        {/* Left side - Menu + Logo */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              if (window.innerWidth >= 1024) {
                setSidebarCollapsed(!sidebarCollapsed);
              } else {
                setSidebarOpen(!sidebarOpen);
              }
            }} 
            className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {sidebarCollapsed ? <Menu size={24} className="text-zinc-900 dark:text-white" /> : <X size={24} className="text-zinc-900 dark:text-white" />}
          </button>
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-wide text-zinc-900 dark:text-white">🐝 HIVEZ</h1>
          </button>
        </div>

        {/* Center - Search bar */}
        <div className="flex-1 max-w-2xl mx-8">
          <div className="relative">
            <Search 
              onClick={() => searchInputRef.current?.focus()}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" 
              size={20}
            />
            <input
              type="text"
              placeholder="Find anything"
              className="w-full rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-900 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-zinc-400 dark:focus:border-zinc-600"
              ref={searchInputRef}
            />
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          <button className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Search size={20} className="text-zinc-900 dark:text-white" />
          </button>
          <button className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <PlusSquare 
              onClick={() => navigate("/create")}
              size={20}
              className="text-zinc-900 dark:text-white"
            />
          </button>
          <button className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <Heart size={20} className="text-zinc-900 dark:text-white" />
          </button>
          <button 
            onClick={() => navigate("/profile")}
            className="rounded-full p-1 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <User size={20} className="text-zinc-900 dark:text-white" />
            )}
          </button>
        </div>
      </header>

      {/* Desktop Sidebar - Below header */}
      <aside 
        className="hidden lg:flex lg:flex-col lg:fixed lg:left-0 lg:top-16 lg:h-[calc(100vh-64px)] lg:bg-white dark:lg:bg-black lg:border-r lg:border-zinc-200 dark:lg:border-zinc-800 lg:z-40 transition-all duration-300"
      >
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center py-4">
            <button onClick={() => go("/")} className={`p-3 transition ${isActive("/") ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}>
              <Home size={22} className="text-zinc-900 dark:text-white" />
            </button>
            {COMMUNITIES.map((community) => (
              <button key={community.id} onClick={() => go(`/hive/${community.id}`)} className={`p-3 transition ${isActive(`/hive/${community.id}`) ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}`} title={community.name}>
                <span className="text-lg">{community.icon}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
              {sidebarContent}
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className={`flex w-full flex-col transition-all duration-300 ${sidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-[280px]"}`}>
        {/* Mobile Top Bar */}
        <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-black/95 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Menu size={22} className="text-zinc-900 dark:text-white" />
            </button>
            <h1 className="text-lg font-bold tracking-wide text-zinc-900 dark:text-white">🐝 HIVEZ</h1>
            <button onClick={() => navigate("/search")} className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Search size={22} className="text-zinc-900 dark:text-white" />
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
              <Home size={22} className={isActive("/") ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"} />
            </button>
            <button onClick={() => navigate("/search")} className="flex flex-col items-center gap-0.5 px-3 py-1">
              <Search size={22} className={isActive("/search") ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"} />
            </button>
            <button onClick={() => navigate("/camera")} className="flex flex-col items-center gap-0.5 px-3 py-1">
              <div className="rounded-full border-2 border-zinc-500 dark:border-zinc-400 p-1">
                <PlusSquare size={18} className="text-zinc-500 dark:text-zinc-400" />
              </div>
            </button>
            <button onClick={() => navigate("/activity")} className="flex flex-col items-center gap-0.5 px-3 py-1">
              <Heart size={22} className={isActive("/activity") ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"} />
            </button>
            <button onClick={() => navigate("/profile")} className="flex flex-col items-center gap-0.5 px-3 py-1">
              <User size={22} className={isActive("/profile") ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"} />
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
