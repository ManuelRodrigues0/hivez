import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Flag,
  MapPin,
  Hexagon,
  Bot,
  Bell,
  BarChart3,
  Image,
  Shield,
  Settings,
  ScrollText,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import HivezLoader from "@/components/common/HivezLoader";
import { checkIsAdmin } from "../../services/admin";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/posts", label: "Posts", icon: FileText },
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/issues", label: "Issues Map", icon: MapPin },
  { to: "/admin/hives", label: "Hives", icon: Hexagon },
  { to: "/admin/ai-queue", label: "AI Review Queue", icon: Bot },
  { to: "/admin/notifications", label: "Push Notifications", icon: Bell },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/media", label: "Media", icon: Image },
  { to: "/admin/roles", label: "Admins & Roles", icon: Shield },
  { to: "/admin/settings", label: "Settings", icon: Settings },
  { to: "/admin/logs", label: "Activity Logs", icon: ScrollText },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktop, setDesktop] = useState(() => window.innerWidth >= 1024);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const resize = () => {
      setDesktop(window.innerWidth >= 1024);
      if (window.innerWidth >= 1024) setSidebarOpen(false);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (!sidebarOpen || desktop) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
    const returnFocus = menuRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() =>
      sidebar.querySelector<HTMLButtonElement>("button")?.focus(),
    );
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSidebarOpen(false);
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...sidebar.querySelectorAll<HTMLElement>(
          "button:not(:disabled),a[href]",
        ),
      ].filter((item) => item.getClientRects().length);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previous;
      returnFocus?.focus();
    };
  }, [sidebarOpen, desktop]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    checkIsAdmin(user.uid).then(setIsAdmin);
  }, [user, navigate]);

  if (!user) return null;

  if (isAdmin === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 text-white">
        <div className="text-center">
          <div className="mb-3 flex justify-center">
            <HivezLoader
              size="md"
              progress={50}
              label="Checking admin access"
            />
          </div>
          <p className="text-sm text-zinc-400">Checking admin access...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 px-6 text-center text-white">
        <div>
          <Shield className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="mb-2 text-2xl font-bold">Access Denied</h1>
          <p className="mb-6 text-sm text-zinc-400">
            You don't have permission to access the admin panel.
          </p>
          <button
            onClick={() => navigate("/")}
            className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        role={sidebarOpen && !desktop ? "dialog" : undefined}
        aria-label="Admin navigation"
        aria-modal={sidebarOpen && !desktop ? true : undefined}
        aria-hidden={!desktop && !sidebarOpen ? true : undefined}
        inert={!desktop && !sidebarOpen}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-800 bg-zinc-900 transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-sm font-black text-black">
              H
            </div>
            <span className="text-lg font-black tracking-tight">HIVEZ</span>
            <span className="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-400">
              Admin
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close admin navigation"
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? "bg-white text-black"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                    }`
                  }
                >
                  <Icon size={18} />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-zinc-800 p-3">
          <button
            onClick={() => navigate("/")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <LogOut size={18} />
            Back to App
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            ref={menuRef}
            aria-label="Open admin navigation"
            aria-expanded={sidebarOpen}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800"
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-bold">Admin Panel</span>
          <div className="w-8" />
        </header>

        {/* Page content */}
        <main
          tabIndex={0}
          aria-label="Admin workspace"
          className="flex-1 overflow-y-auto"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
