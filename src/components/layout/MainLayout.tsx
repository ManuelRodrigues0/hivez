import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Bell, Home, Search, PlusSquare, User, Menu, X, Settings, LogOut, HandHeart, MessageCircle } from "lucide-react";
import { collection, onSnapshot } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { COMMUNITIES } from "../../constants/communities";
import { logout } from "../../services/auth";
import CreateModal from "../../components/feed/CreateModal";
import { db } from "@/firebase/firebase";
import { listenToNotifications, listenToUnreadNotificationsCount } from "@/services/notifications";
import { listenForForegroundPushNotifications } from "@/services/pushNotifications";

const ultraBeeSrc = "/assets/hivez-ultra-bee.webm";

function UltraBeeMark() {
  return (
    <video
      className="app-ultra-bee-mark"
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

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
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
    "--feed-max": isSidebarExpanded
      ? "min(760px, calc(100vw - var(--layout-left) - var(--layout-right) - var(--layout-gap)))"
      : "calc(100vw - var(--layout-left) - var(--layout-right) - var(--layout-gap))",
    "--media-card-width": isSidebarExpanded ? "204px" : "236px",
  } as CSSProperties;

  const isActive = (path: string) => location.pathname === path;

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

    return onSnapshot(collection(db, "chats"), (snapshot) => {
      const chats = snapshot.docs
        .map((chatDoc) => ({ id: chatDoc.id, ...(chatDoc.data() as any) }))
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
        if (!lastTime || lastTime <= previousTime || chat.lastMessageSenderId === user.uid) return;

        const otherId = chat.participants.find((id: string) => id !== user.uid);
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

  const sidebarContent = (
    <>
      {/* Home */}
      <button
        onClick={() => go("/")}
        className={`flex w-full items-center gap-4 px-5 py-4 transition ${
          isActive("/") ? "bg-zinc-100 font-semibold dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
        }`}
      >
        <Home size={22} className="text-zinc-900 dark:text-white flex-shrink-0" /> 
        <span className="text-zinc-900 dark:text-white">Home</span>
      </button>

      <button
        onClick={() => go("/volunteering")}
        className={`flex w-full items-center gap-4 px-5 py-4 transition ${
          isActive("/volunteering") ? "bg-zinc-100 font-semibold dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
        }`}
      >
        <HandHeart size={22} className="text-zinc-900 dark:text-white flex-shrink-0" /> 
        <span className="text-zinc-900 dark:text-white">Volunteering</span>
      </button>

      <button
        onClick={() => go("/notifications")}
        className={`flex w-full items-center gap-4 px-5 py-4 transition ${
          isActive("/notifications") ? "bg-zinc-100 font-semibold dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
        }`}
      >
        <span className="relative flex-shrink-0">
          <Bell size={22} className="text-zinc-900 dark:text-white" />
          {unreadNotifications > 0 && <Badge count={unreadNotifications} />}
        </span>
        <span className="text-zinc-900 dark:text-white">Notifications</span>
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
    <div
      className="app-shell flex min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-white"
      style={layoutVars}
    >
      {/* Desktop Header - Fixed at top */}
      <header className="app-desktop-header hidden lg:fixed lg:top-0 lg:left-0 lg:right-0 lg:z-50 lg:flex lg:items-center lg:justify-between lg:border-b lg:border-zinc-200 dark:lg:border-zinc-800 lg:bg-white dark:lg:bg-black lg:px-4 lg:h-16">
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
          <button onClick={() => navigate("/")} className="app-brand-button flex items-center gap-1.5">
            <h1 className="text-2xl font-black tracking-wide text-zinc-900 dark:text-white">Hivez</h1>
            <UltraBeeMark />
          </button>
        </div>

        {/* Center - Page Title */}
        <div className="flex-1">
          <h1 className="text-center text-lg font-bold text-zinc-900 dark:text-white">
            {getPageTitle(location.pathname)}
          </h1>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate("/notifications")}
            className="relative rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Bell size={20} className="text-zinc-900 dark:text-white" />
            {unreadNotifications > 0 && <Badge count={unreadNotifications} />}
          </button>
          <button 
            onClick={() => navigate("/search")}
            className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Search size={20} className="text-zinc-900 dark:text-white" />
          </button>
          <button 
            onClick={() => setCreateModalOpen(true)}
            className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <PlusSquare size={20} className="text-zinc-900 dark:text-white" />
          </button>
          <button
            onClick={() => navigate("/volunteering")}
            className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <HandHeart size={20} className="text-zinc-900 dark:text-white" />
          </button>
          <button
            onClick={() => navigate("/chats")}
            className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <MessageCircle size={20} className="text-zinc-900 dark:text-white" />
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
        className="app-sidebar hidden lg:fixed lg:left-0 lg:top-16 lg:z-40 lg:flex lg:h-[calc(100vh-64px)] lg:w-[var(--layout-left)] lg:flex-col lg:border-r lg:border-zinc-200 lg:bg-white transition-[width] duration-300 dark:lg:border-zinc-800 dark:lg:bg-black"
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {isSidebarExpanded ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
              {sidebarContent}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
            <button onClick={() => go("/")} className={`p-3 transition ${isActive("/") ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}`}>
              <Home size={22} className="text-zinc-900 dark:text-white" />
            </button>
            <button onClick={() => go("/volunteering")} className={`p-3 transition ${isActive("/volunteering") ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}`} title="Volunteering">
              <HandHeart size={22} className="text-zinc-900 dark:text-white" />
            </button>
            <button onClick={() => go("/notifications")} className={`relative p-3 transition ${isActive("/notifications") ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}`} title="Notifications">
              <Bell size={22} className="text-zinc-900 dark:text-white" />
              {unreadNotifications > 0 && <Badge count={unreadNotifications} />}
            </button>
            {COMMUNITIES.map((community) => (
              <button key={community.id} onClick={() => go(`/hive/${community.id}`)} className={`p-3 transition ${isActive(`/hive/${community.id}`) ? "bg-zinc-100 dark:bg-zinc-800" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}`} title={community.name}>
                <span className="text-lg">{community.icon}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex w-full flex-col transition-[margin] duration-300 lg:ml-[var(--layout-left)]">
        {/* Updates Sidebar - Desktop only */}
        <aside className="app-updates fixed right-0 top-16 hidden h-[calc(100vh-64px)] w-[var(--layout-right)] overflow-y-auto px-4 py-6 lg:block">
          <div className="app-updates-card rounded-2xl border border-zinc-200/80 bg-zinc-100 p-4 dark:border-zinc-800/80 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Updates</h2>
              <button className="text-sm font-medium text-sky-600 transition hover:text-sky-500 dark:text-sky-400">
                Clear
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">System Update</p>
                </div>
                <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-300">New features have been deployed</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">2 hours ago</p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">Community Growth</p>
                </div>
                <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-300">100 new members joined this week</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">5 hours ago</p>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-white">Maintenance</p>
                </div>
                <p className="mt-1 text-sm leading-5 text-zinc-600 dark:text-zinc-300">Scheduled maintenance tonight</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">1 day ago</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Content wrapper */}
        <div className="flex w-full flex-col transition-[padding] duration-300 lg:pr-[var(--layout-right)]">
          {/* Mobile Top Bar */}
          <header className="app-mobile-header sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-black/95 lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button onClick={() => setSidebarOpen(true)} className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Menu size={22} className="text-zinc-900 dark:text-white" />
              </button>
              <div className="app-mobile-brand flex items-center gap-1.5" aria-label="Hivez">
                <h1 className="text-lg font-bold tracking-wide text-zinc-900 dark:text-white">Hivez</h1>
                <UltraBeeMark />
              </div>
              <button 
                onClick={() => navigate("/notifications")}
                className="relative rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Bell size={22} className="text-zinc-900 dark:text-white" />
                {unreadNotifications > 0 && <Badge count={unreadNotifications} />}
              </button>
            </div>
          </header>

          {/* Mobile Sidebar */}
          {sidebarOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
              <div className="app-mobile-drawer fixed left-0 top-0 z-50 flex h-screen w-80 max-w-[85%] flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:hidden">
                <div className="border-b border-zinc-200 dark:border-zinc-800 px-5 pt-4 pb-2">
                  <h1 className="text-2xl font-black tracking-wide text-zinc-900 dark:text-white">Hivez</h1>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Report. React. Resolve.</p>
                </div>
                {sidebarContent}
              </div>
            </>
          )}

        {/* Page Content - left aligned, same width */}
        <main className="app-main flex-1 overflow-y-auto pb-20 lg:pb-0 lg:pt-16">
          <div className="app-feed-shell mr-auto w-full max-w-[var(--feed-max)] px-0 transition-[max-width] duration-300 lg:px-0">
            <Outlet />
          </div>
        </main>

          {/* Mobile Bottom Nav */}
          <nav className="app-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-black lg:hidden">
            <div className="flex items-center justify-around py-2">
              <button onClick={() => navigate("/")} className="flex flex-col items-center gap-0.5 px-3 py-1">
                <Home size={22} className={isActive("/") ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"} />
              </button>
              <button onClick={() => navigate("/search")} className="flex flex-col items-center gap-0.5 px-3 py-1">
                <Search size={22} className={isActive("/search") ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"} />
              </button>
              <button onClick={() => setCreateModalOpen(true)} className="flex flex-col items-center gap-0.5 px-3 py-1">
                <div className="rounded-full border-2 border-zinc-500 dark:border-zinc-400 p-1">
                  <PlusSquare size={18} className="text-zinc-500 dark:text-zinc-400" />
                </div>
              </button>
              <button onClick={() => navigate("/chats")} className="flex flex-col items-center gap-0.5 px-3 py-1">
                <MessageCircle size={22} className={isActive("/chats") ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"} />
              </button>
              <button onClick={() => navigate("/profile")} className="flex flex-col items-center gap-0.5 px-3 py-1">
                <User size={22} className={isActive("/profile") ? "text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"} />
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

function Badge({ count }: { count: number }) {
  return (
    <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}
