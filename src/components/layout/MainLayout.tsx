import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Bell,
  Home,
  Search,
  PlusSquare,
  User,
  Menu,
  X,
  Settings,
  LogOut,
  HandHeart,
  MessageCircle,
  Map,
} from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import gsap from "gsap";
import { useAuth } from "../../context/AuthContext";
import { COMMUNITIES } from "../../constants/communities";
import { logout } from "../../services/auth";
import CreateModal from "../../components/feed/CreateModal";
import HiveSearch from "../../components/hiveSearch/HiveSearch";
import { db } from "@/firebase/firebase";
import { listenToNotifications, listenToUnreadNotificationsCount } from "@/services/notifications";
import { listenForForegroundPushNotifications } from "@/services/pushNotifications";
import UpdatesPanel from "./UpdatesPanel";

const ultraBeeSrc = "/assets/hivez-ultra-bee.webm";

interface ChatPreviewDoc {
  id: string;
  participants?: string[];
  participantProfiles?: Record<string, { displayName?: string; username?: string }>;
  lastMessageAt?: { toDate?: () => Date } | null;
  lastMessageSenderId?: string;
}

function UltraBeeMark({ size = "md" }: { size?: "sm" | "md" }) {
  const sizeClasses = {
    sm: "h-5 w-5",
    md: "h-7 w-7",
  };

  return (
    <video
      className={`app-ultra-bee-mark object-contain shrink-0 ${sizeClasses[size]}`}
      src={ultraBeeSrc}
      autoPlay
      loop
      muted
      playsInline
      disablePictureInPicture
      controlsList="nodownload nofullscreen noremoteplayback"
      aria-hidden="true"
      preload="metadata"
    />
  );
}

function Badge({ count }: { count: number }) {
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-xs">
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const notificationsReady = useRef(false);
  const seenChatTimes = useRef<Record<string, number>>({});
  const chatsReady = useRef(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  const handleSidebarMouseEnter = () => {
    if (window.innerWidth >= 1024 && sidebarCollapsed) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      hoverTimeoutRef.current = window.setTimeout(() => {
        setIsHoveringSidebar(true);
      }, 100);
    }
  };

  const handleSidebarMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHoveringSidebar(false);
  };

  const isSidebarExpanded = !sidebarCollapsed || isHoveringSidebar;

  const layoutVars = {
    "--layout-left": isSidebarExpanded ? "280px" : "72px",
    "--layout-right": "384px",
    "--layout-gap": "16px",
    "--media-card-width": "236px",
  } as CSSProperties;

  const isActive = (path: string) => location.pathname === path;

  // GSAP: Minimalist Stagger Entrance on expansion
  useEffect(() => {
    if (isSidebarExpanded) {
      gsap.fromTo(
        ".gsap-minimal-item",
        { opacity: 0, x: -6 },
        { opacity: 1, x: 0, stagger: 0.02, duration: 0.22, ease: "power2.out" }
      );
    }
  }, [isSidebarExpanded]);

  useEffect(() => {
    if (!user) return;
    return listenToUnreadNotificationsCount(user.uid, setUnreadNotifications, (error) => {
      console.error("Unread notifications listener failed:", error);
    });
  }, [user]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    listenForForegroundPushNotifications().then((nextUnsubscribe) => {
      unsubscribe = nextUnsubscribe;
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    notificationsReady.current = false;
    seenNotificationIds.current = new Set();

    return listenToNotifications(user.uid, (notifications) => {
      if (!notificationsReady.current) {
        seenNotificationIds.current = new Set(notifications.map((notification) => notification.id));
        notificationsReady.current = true;
        return;
      }

      notifications.forEach((notification) => {
        if (seenNotificationIds.current.has(notification.id)) return;
        seenNotificationIds.current.add(notification.id);
        const actorName = notification.actorDisplayName || notification.actorUsername || "Someone";
        const message =
          notification.type === "comment"
            ? `${actorName} commented on your post`
            : notification.type === "follow"
            ? `${actorName} followed you`
            : `${actorName} liked your post`;

        console.log("New notification:", message);
      });
    });
  }, [navigate, user]);

  useEffect(() => {
    if (!user) return;
    chatsReady.current = false;
    seenChatTimes.current = {};

    return onSnapshot(query(collection(db, "chats"), where("participants", "array-contains", user.uid)), (snapshot) => {
      const chats = snapshot.docs
        .map((chatDoc) => ({ id: chatDoc.id, ...(chatDoc.data() as Omit<ChatPreviewDoc, "id">) }))
        .filter((chat) => chat.participants?.includes(user.uid));

      if (!chatsReady.current) {
        seenChatTimes.current = Object.fromEntries(
          chats.map((chat) => [chat.id, chat.lastMessageAt?.toDate?.().getTime?.() || 0])
        );
        chatsReady.current = true;
        return;
      }

      chats.forEach((chat) => {
        const lastTime = chat.lastMessageAt?.toDate?.().getTime?.() || 0;
        const previousTime = seenChatTimes.current[chat.id] || 0;
        seenChatTimes.current[chat.id] = lastTime;
        if (!lastTime || lastTime <= previousTime || chat.lastMessageSenderId === user.uid || chat.lastMessageSenderId === "ultra-bee") return;

        const otherId = chat.participants?.find((id) => id !== user.uid);
        const sender = otherId ? chat.participantProfiles?.[otherId] : null;
        console.log(`${sender?.displayName || sender?.username || "Someone"} sent you a message`);
      });
    });
  }, [navigate, user]);

  function getPageTitle(pathname: string): string {
    switch (pathname) {
      case "/":
        return "For you";
      case "/search":
        return "Search";
      case "/profile":
        return "Profile";
      case "/activity":
        return "Activity";
      case "/volunteering":
        return "Volunteering";
      case "/chats":
        return "Chats";
      case "/notifications":
        return "Notifications";
      case "/map":
        return "Map";
      case "/settings":
        return "Settings";
      case "/profile/edit":
        return "Edit Profile";
      default:
        if (pathname.startsWith("/hive/")) {
          return "Community";
        }
        return "HIVEZ";
    }
  }

  function go(path: string) {
    navigate(path);
    setSidebarOpen(false);
  }

  // Properly Scrollable Expanded Sidebar Menu View
  const sidebarContent = (
    <div className="flex h-full w-full flex-col justify-between bg-[#f7f7f2] dark:bg-[#0d0d0d] select-none overflow-hidden">
      {/* Scrollable Upper Section */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-neutral-800">
        {/* Core Primary Navigation */}
        <div className="space-y-1.5">
          {[
            { label: "Home", path: "/", icon: Home },
            { label: "Volunteering", path: "/volunteering", icon: HandHeart },
            { label: "Notifications", path: "/notifications", icon: Bell, badge: unreadNotifications },
            { label: "Map", path: "/map", icon: Map },
          ].map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => go(item.path)}
                className={`gsap-minimal-item group relative flex w-full items-center justify-start rounded-xl px-3.5 py-3 text-sm font-bold tracking-tight transition-all duration-200 ${
                  active
                    ? "bg-[#3d654c] text-white shadow-sm shadow-[#3d654c]/20 dark:bg-[#f2c14e] dark:text-[#121212] dark:shadow-[#f2c14e]/20"
                    : "text-[#1c1d1a]/80 hover:bg-[#1c1d1a]/5 hover:text-[#1c1d1a] dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3.5 truncate">
                  <div className="relative flex shrink-0 items-center justify-center">
                    <Icon
                      size={20}
                      className={`transition-transform duration-200 group-hover:scale-105 ${
                        active
                          ? "text-white dark:text-[#121212]"
                          : "text-[#3d654c] dark:text-[#f2c14e]"
                      }`}
                    />
                    {item.badge && item.badge > 0 ? <Badge count={item.badge} /> : null}
                  </div>
                  <span className="truncate text-[15px] font-bold tracking-tight">{item.label}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Communities Section */}
        <div>
          <div className="flex items-center justify-between px-3 pb-2.5 text-xs font-black uppercase tracking-[0.2em] text-[#1c1d1a]/45 dark:text-neutral-400">
            <span>Hives</span>
            <span className="rounded-full bg-[#1c1d1a]/5 px-2.5 py-0.5 text-[10px] font-bold text-[#3d654c] dark:bg-[#f2c14e]/10 dark:text-[#f2c14e]">
              {COMMUNITIES.length} Wards
            </span>
          </div>

          <div className="mb-2 px-1">
            <HiveSearch
              placeholder="Search Hives..."
              maxResults={6}
              onSelect={(hiveId) => go(`/hive/${hiveId}`)}
              onCreateNewIssue={() => {
                setSidebarOpen(false);
                navigate("/create", { state: { reportMode: true } });
              }}
            />
          </div>
        </div>
      </div>

      {/* Pinned Footer Action Dock */}
      <div className="shrink-0 border-t border-[#1c1d1a]/8 px-3.5 py-3 space-y-1 bg-[#f7f7f2] dark:bg-[#0d0d0d] dark:border-neutral-800/80">
        <button
          onClick={() => go("/settings")}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[#1c1d1a]/75 transition hover:bg-[#1c1d1a]/5 hover:text-[#1c1d1a] dark:text-neutral-300 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <Settings size={18} className="text-[#1c1d1a]/60 dark:text-neutral-400" />
          <span>Settings</span>
        </button>

        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:text-rose-400"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="app-shell flex min-h-screen bg-[#f7f7f2] dark:bg-[#0a0a0a] text-[#1c1d1a] dark:text-neutral-100"
      style={layoutVars}
    >
      {/* Desktop Header */}
      <header className="app-desktop-header hidden lg:fixed lg:top-0 lg:left-0 lg:right-0 lg:z-50 lg:flex lg:items-center lg:justify-between lg:border-b lg:border-[#1c1d1a]/10 dark:lg:border-neutral-800 lg:bg-[#f7f7f2]/90 dark:lg:bg-[#0a0a0a]/90 lg:backdrop-blur-xl lg:px-4 lg:h-16">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              if (window.innerWidth >= 1024) {
                setSidebarCollapsed(!sidebarCollapsed);
              } else {
                setSidebarOpen(!sidebarOpen);
              }
            }} 
            className="rounded-full p-2 transition hover:bg-[#1c1d1a]/5 dark:hover:bg-white/10"
          >
            {sidebarCollapsed ? <Menu size={22} className="text-[#1c1d1a] dark:text-white" /> : <X size={22} className="text-[#1c1d1a] dark:text-white" />}
          </button>
          <button onClick={() => navigate("/")} className="app-brand-button flex items-center gap-1.5">
            <h1 className="text-2xl font-black tracking-wide text-[#1c1d1a] dark:text-white">Hivez</h1>
            <UltraBeeMark />
          </button>
        </div>

        <div className="flex-1">
          <h1 className="text-center text-lg font-bold text-[#1c1d1a] dark:text-white">
            {getPageTitle(location.pathname)}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate("/notifications")}
            className="relative rounded-full p-2 transition hover:bg-[#1c1d1a]/5 dark:hover:bg-white/10"
          >
            <Bell size={20} className="text-[#1c1d1a] dark:text-white" />
            {unreadNotifications > 0 && <Badge count={unreadNotifications} />}
          </button>
          <button 
            onClick={() => navigate("/search")}
            className="rounded-full p-2 transition hover:bg-[#1c1d1a]/5 dark:hover:bg-white/10"
          >
            <Search size={20} className="text-[#1c1d1a] dark:text-white" />
          </button>
          <button 
            onClick={() => setCreateModalOpen(true)}
            className="rounded-full p-2 transition hover:bg-[#1c1d1a]/5 dark:hover:bg-white/10"
          >
            <PlusSquare size={20} className="text-[#1c1d1a] dark:text-white" />
          </button>
          <button
            onClick={() => navigate("/volunteering")}
            className="rounded-full p-2 transition hover:bg-[#1c1d1a]/5 dark:hover:bg-white/10"
          >
            <HandHeart size={20} className="text-[#1c1d1a] dark:text-white" />
          </button>
          <button
            onClick={() => navigate("/chats")}
            className="rounded-full p-2 transition hover:bg-[#1c1d1a]/5 dark:hover:bg-white/10"
          >
            <MessageCircle size={20} className="text-[#1c1d1a] dark:text-white" />
          </button>
          <button 
            onClick={() => navigate("/profile")}
            className="rounded-full p-1 transition hover:bg-[#1c1d1a]/5 dark:hover:bg-white/10"
          >
            {user?.photoURL || profile?.photoURL ? (
              <img src={profile?.photoURL || user?.photoURL || ""} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <User size={20} className="text-[#1c1d1a] dark:text-white" />
            )}
          </button>
        </div>
      </header>

      {/* Desktop Sidebar Rail */}
      <aside 
        ref={sidebarRef}
        className="app-sidebar hidden lg:fixed lg:left-0 lg:top-16 lg:z-40 lg:flex lg:h-[calc(100vh-64px)] lg:flex-col lg:border-r lg:border-[#1c1d1a]/10 lg:bg-[#f7f7f2] dark:lg:border-neutral-800/80 dark:lg:bg-[#0a0a0a] transition-[width] duration-300 overflow-hidden"
        style={{ width: "var(--layout-left)" }}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {isSidebarExpanded ? (
          <div className="flex flex-col h-full w-full overflow-hidden">
            <div className="flex-1 overflow-y-auto">
              {sidebarContent}
            </div>
          </div>
        ) : (
          /* Perfectly Centered 72px Collapsed Rail */
          <div className="flex flex-col items-center justify-between h-full w-[72px] shrink-0 py-4 select-none overflow-hidden">
            <div className="flex flex-col items-center w-full space-y-2">
              {/* Primary Navigation Icons */}
              {[
                { path: "/", icon: Home, label: "Home" },
                { path: "/volunteering", icon: HandHeart, label: "Volunteering" },
                { path: "/notifications", icon: Bell, label: "Notifications", badge: unreadNotifications },
                { path: "/map", icon: Map, label: "Map" },
              ].map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.label}
                    onClick={() => go(item.path)}
                    title={item.label}
                    className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all duration-200 ${
                      active
                        ? "bg-[#3d654c] text-white shadow-sm dark:bg-[#f2c14e] dark:text-[#121212] dark:shadow-[#f2c14e]/20 scale-105"
                        : "text-[#1c1d1a]/70 hover:bg-[#1c1d1a]/5 hover:text-[#1c1d1a] dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
                    }`}
                  >
                    <Icon size={20} />
                    {item.badge && item.badge > 0 ? <Badge count={item.badge} /> : null}
                  </button>
                );
              })}

              {/* Minimal Divider */}
              <div className="h-[1px] w-6 bg-[#1c1d1a]/10 dark:bg-neutral-800 my-1 shrink-0" />
            </div>

            {/* Bottom Controls */}
            <div className="flex flex-col items-center w-full pt-2 border-t border-[#1c1d1a]/10 dark:border-neutral-800/80 space-y-1.5">
              <button
                onClick={() => go("/settings")}
                title="Settings"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#1c1d1a]/70 hover:bg-[#1c1d1a]/5 hover:text-[#1c1d1a] transition-all dark:text-neutral-400 dark:hover:bg-white/10"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={logout}
                title="Logout"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-600 transition-all dark:hover:bg-rose-950/40 dark:text-rose-400"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex w-full flex-col transition-[margin] duration-300 lg:ml-[var(--layout-left)]">
        {/* Updates Sidebar (Desktop) */}
        <aside className="app-updates fixed right-0 top-16 hidden h-[calc(100vh-64px)] w-[var(--layout-right)] overflow-y-auto px-4 py-6 lg:block">
          <UpdatesPanel />
        </aside>

        {/* Content wrapper */}
        <div className="flex w-full flex-col transition-[padding] duration-300 lg:pr-[var(--layout-right)]">
          {/* Mobile Top Bar */}
          <header className="app-mobile-header sticky top-0 z-40 border-b border-[#1c1d1a]/10 bg-[#f7f7f2]/95 backdrop-blur dark:border-neutral-800 dark:bg-[#0a0a0a]/95 lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button onClick={() => setSidebarOpen(true)} className="rounded-full p-2 transition hover:bg-[#1c1d1a]/5 dark:hover:bg-white/10">
                <Menu size={22} className="text-[#1c1d1a] dark:text-white" />
              </button>
              <div className="app-mobile-brand flex items-center gap-1.5" aria-label="Hivez">
                <h1 className="text-lg font-bold tracking-wide text-[#1c1d1a] dark:text-white">Hivez</h1>
                <UltraBeeMark />
              </div>
              <button 
                onClick={() => navigate("/notifications")}
                className="relative rounded-full p-2 transition hover:bg-[#1c1d1a]/5 dark:hover:bg-white/10"
              >
                <Bell size={22} className="text-[#1c1d1a] dark:text-white" />
                {unreadNotifications > 0 && <Badge count={unreadNotifications} />}
              </button>
            </div>
          </header>

          {/* Mobile Sidebar Slide-Over Drawer */}
          {sidebarOpen && (
            <>
              <div
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <div
                className="app-mobile-drawer fixed left-0 top-0 z-50 flex h-screen w-72 max-w-[80vw] flex-col border-r border-[#1c1d1a]/10 bg-[#f7f7f2] shadow-2xl dark:border-neutral-800 dark:bg-[#0d0d0d] overflow-hidden lg:hidden"
              >
                {/* Mobile Drawer Header */}
                <div className="flex w-full items-center justify-between border-b border-[#1c1d1a]/10 px-4 py-3 bg-white/60 dark:border-neutral-800 dark:bg-neutral-900/60 shrink-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-black tracking-tight text-[#1c1d1a] dark:text-white">Hivez</h1>
                    <UltraBeeMark size="md" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    aria-label="Close menu"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200/70 hover:bg-neutral-300 text-[#1c1d1a] transition dark:bg-neutral-800 dark:text-white dark:hover:bg-neutral-700"
                  >
                    <X size={15} />
                  </button>
                </div>
                
                <div className="flex-1 w-full overflow-y-auto">{sidebarContent}</div>
              </div>
            </>
          )}

          {/* Page Content */}
          <main className="app-main flex-1 overflow-y-auto pb-20 lg:pb-0 lg:pt-16">
            <div className="app-feed-shell min-w-0 px-0">
              <Outlet />
            </div>
          </main>

          {/* Mobile Bottom Nav */}
          <nav className="app-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-[#1c1d1a]/10 bg-[#f7f7f2]/95 py-2 backdrop-blur-xl dark:border-neutral-800 dark:bg-[#0a0a0a]/95 lg:hidden">
            <div className="flex items-center justify-around py-2">
              <button onClick={() => navigate("/")} className="flex flex-col items-center gap-0.5 px-3 py-1">
                <Home size={22} className={isActive("/") ? "text-[#3d654c] dark:text-[#f2c14e]" : "text-[#1c1d1a]/50 dark:text-neutral-500"} />
              </button>
              <button onClick={() => navigate("/search")} className="flex flex-col items-center gap-0.5 px-3 py-1">
                <Search size={22} className={isActive("/search") ? "text-[#3d654c] dark:text-[#f2c14e]" : "text-[#1c1d1a]/50 dark:text-neutral-500"} />
              </button>
              <button onClick={() => setCreateModalOpen(true)} className="flex flex-col items-center gap-0.5 px-3 py-1">
                <div className="rounded-full bg-[#3d654c] text-white p-2 shadow-md shadow-[#3d654c]/30 dark:bg-[#f2c14e] dark:text-[#121212] dark:shadow-[#f2c14e]/30">
                  <PlusSquare size={18} />
                </div>
              </button>
              <button onClick={() => navigate("/chats")} className="flex flex-col items-center gap-0.5 px-3 py-1">
                <MessageCircle size={22} className={isActive("/chats") ? "text-[#3d654c] dark:text-[#f2c14e]" : "text-[#1c1d1a]/50 dark:text-neutral-500"} />
              </button>
              <button onClick={() => navigate("/profile")} className="flex flex-col items-center gap-0.5 px-3 py-1">
                <User size={22} className={isActive("/profile") ? "text-[#3d654c] dark:text-[#f2c14e]" : "text-[#1c1d1a]/50 dark:text-neutral-500"} />
              </button>
            </div>
          </nav>
        </div>
        
        {/* Create Modal */}
        <CreateModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
      </div>
    </div>
  );
}
