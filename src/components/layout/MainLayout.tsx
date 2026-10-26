import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Bell,
  Menu,
  X,
  Search,
  Plus,
  User,
  Megaphone,
  Sun,
  Moon,
  Home,
  MessageCircle,
} from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { logout } from "@/services/auth";
import CreateModal from "@/components/feed/CreateModal";
import { db } from "@/firebase/firebase";
import {
  listenToNotifications,
  listenToUnreadNotificationsCount,
} from "@/services/notifications";
import { listenForForegroundPushNotifications } from "@/services/pushNotifications";
import UpdatesPanel from "./UpdatesPanel";
import HiveNav from "./HiveNav";
import "./updatesPanel.css";
import "@/styles/workspace.css";

interface ChatPreviewDoc {
  id: string;
  participants?: string[];
  participantProfiles?: Record<
    string,
    { displayName?: string; username?: string }
  >;
  lastMessageAt?: { toDate?: () => Date } | null;
  lastMessageSenderId?: string;
}
function UltraBeeMark() {
  const { reducedMotion } = useTheme();
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const update = () => {
      if (reducedMotion || document.hidden) video.pause();
      else void video.play().catch(() => {});
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      video.pause();
    };
  }, [reducedMotion]);
  return (
    <video
      ref={ref}
      className="hv-brand-bee"
      src="/assets/hivez-ultra-bee.webm"
      autoPlay={!reducedMotion}
      loop
      muted
      playsInline
      disablePictureInPicture
      aria-hidden="true"
      preload="metadata"
    />
  );
}
function Badge({ count }: { count: number }) {
  return <span className="hv-count">{count > 9 ? "9+" : count}</span>;
}

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [desktopViewport, setDesktopViewport] = useState(
    () => window.innerWidth >= 1024,
  );
  const [updatesCollapsed, setUpdatesCollapsed] = useState(() => {
    const saved = localStorage.getItem("hivez-updates-collapsed");
    return saved === null ? true : saved === "true";
  });
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [communityUpdatesCount, setCommunityUpdatesCount] = useState(0);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const notificationsReady = useRef(false);
  const seenChatTimes = useRef<Record<string, number>>({});
  const chatsReady = useRef(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const desktopUpdatesTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileUpdatesTriggerRef = useRef<HTMLButtonElement>(null);
  const updatesCloseRef = useRef<HTMLButtonElement>(null);
  const updatesReturnFocusRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const updateViewport = () => setDesktopViewport(window.innerWidth >= 1024);
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

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
    "--layout-left": isSidebarExpanded ? "238px" : "76px",
    // Desktop Updates is a persistent side rail while open, so page layouts
    // reflow into the remaining space instead of being covered by the panel.
    "--layout-right": updatesCollapsed || !desktopViewport ? "0px" : "384px",
    "--layout-gap": "16px",
    "--media-card-width": "236px",
  } as CSSProperties;

  const openUpdates = (trigger: HTMLButtonElement) => {
    updatesReturnFocusRef.current = trigger;
    setUpdatesCollapsed(false);
    localStorage.setItem("hivez-updates-collapsed", "false");
    requestAnimationFrame(() => updatesCloseRef.current?.focus());
  };

  const closeUpdates = (restoreFocus = true) => {
    setUpdatesCollapsed(true);
    localStorage.setItem("hivez-updates-collapsed", "true");
    if (restoreFocus) {
      requestAnimationFrame(() => updatesReturnFocusRef.current?.focus());
    }
  };

  useEffect(() => {
    if (updatesCollapsed) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.querySelector("dialog[open]")) return;
        setUpdatesCollapsed(true);
        localStorage.setItem("hivez-updates-collapsed", "true");
        requestAnimationFrame(() => updatesReturnFocusRef.current?.focus());
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [updatesCollapsed]);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (!user) return;
    return listenToUnreadNotificationsCount(
      user.uid,
      setUnreadNotifications,
      (error) => {
        console.error("Unread notifications listener failed:", error);
      },
    );
  }, [user]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let disposed = false;
    listenForForegroundPushNotifications()
      .then((nextUnsubscribe) => {
        if (disposed) nextUnsubscribe?.();
        else unsubscribe = nextUnsubscribe;
      })
      .catch((error: unknown) =>
        console.error("Foreground notifications unavailable:", error),
      );
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(
    () => () => {
      if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!user) return;
    notificationsReady.current = false;
    seenNotificationIds.current = new Set();

    return listenToNotifications(user.uid, (notifications) => {
      if (!notificationsReady.current) {
        seenNotificationIds.current = new Set(
          notifications.map((notification) => notification.id),
        );
        notificationsReady.current = true;
        return;
      }

      notifications.forEach((notification) => {
        if (seenNotificationIds.current.has(notification.id)) return;
        seenNotificationIds.current.add(notification.id);
        const actorName =
          notification.actorDisplayName ||
          notification.actorUsername ||
          "Someone";
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

    return onSnapshot(
      query(
        collection(db, "chats"),
        where("participants", "array-contains", user.uid),
      ),
      (snapshot) => {
        const chats = snapshot.docs
          .map((chatDoc) => ({
            id: chatDoc.id,
            ...(chatDoc.data() as Omit<ChatPreviewDoc, "id">),
          }))
          .filter((chat) => chat.participants?.includes(user.uid));

        if (!chatsReady.current) {
          seenChatTimes.current = Object.fromEntries(
            chats.map((chat) => [
              chat.id,
              chat.lastMessageAt?.toDate?.().getTime?.() || 0,
            ]),
          );
          chatsReady.current = true;
          return;
        }

        chats.forEach((chat) => {
          const lastTime = chat.lastMessageAt?.toDate?.().getTime?.() || 0;
          const previousTime = seenChatTimes.current[chat.id] || 0;
          seenChatTimes.current[chat.id] = lastTime;
          if (
            !lastTime ||
            lastTime <= previousTime ||
            chat.lastMessageSenderId === user.uid ||
            chat.lastMessageSenderId === "ultra-bee"
          )
            return;

          const otherId = chat.participants?.find((id) => id !== user.uid);
          const sender = otherId ? chat.participantProfiles?.[otherId] : null;
          console.log(
            `${sender?.displayName || sender?.username || "Someone"} sent you a message`,
          );
        });
      },
    );
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
        if (pathname.startsWith("/settings/")) {
          const section = pathname.split("/")[2];
          const settingsTitles: Record<string, string> = {
            account: "Account",
            privacy: "Privacy",
            security: "Security",
            notifications: "Notifications",
            content: "Content preferences",
            appearance: "Appearance",
            accessibility: "Accessibility",
            language: "Language",
            data: "Data",
            delete: "Delete / deactivate",
          };
          return settingsTitles[section] || "Settings";
        }
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

  const { resolvedTheme, toggleTheme } = useTheme();
  const mobileNavRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = mobileNavRef.current;
    if (!dialog) return;
    if (sidebarOpen && !desktopViewport && !dialog.open) dialog.showModal();
    if ((!sidebarOpen || desktopViewport) && dialog.open) dialog.close();
    if (!sidebarOpen || desktopViewport) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sidebarOpen, desktopViewport]);

  const brand = (
    <>
      <svg viewBox="0 0 33 31" aria-hidden="true">
        <path d="m9 0 9 5v10l-9 5-9-5V5Z" />
        <path d="m9 11 9 5v10l-9 5-9-5V16Z" />
        <path d="m24 5.5 9 5v10l-9 5-9-5v-10Z" />
      </svg>
      <span>hivez.</span>
    </>
  );
  const profilePhoto = profile?.photoURL || user?.photoURL;
  return (
    <div
      className="hv-app app-shell hv-workspace"
      data-app-theme={resolvedTheme}
      data-sidebar-expanded={isSidebarExpanded}
      data-updates-open={!updatesCollapsed}
      style={layoutVars}
    >
      <a className="hv-skip" href="#hv-content">
        Skip to content
      </a>
      <header className="app-desktop-header hv-topbar">
        <div className="hv-topbar-brand">
          <button
            className="hv-icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            aria-label={
              sidebarCollapsed ? "Expand navigation" : "Collapse navigation"
            }
            aria-expanded={!sidebarCollapsed}
          >
            <Menu size={20} />
          </button>
          <Link className="hv-brand" to="/" aria-label="Hivez home">
            {brand}
          </Link>
          <UltraBeeMark />
        </div>
        <button
          className="hv-global-search"
          onClick={() => go("/search")}
          aria-label="Search Hivez"
        >
          <Search size={17} />
          <span>People, posts, and possibilities</span>
          <span className="hv-search-context">
            {getPageTitle(location.pathname)}
          </span>
        </button>
        <div className="hv-topbar-actions">
          <button
            className="hv-icon"
            onClick={toggleTheme}
            aria-label={
              resolvedTheme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
          >
            {resolvedTheme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <button
            className="hv-icon"
            onClick={() => go("/notifications")}
            aria-label="Notifications"
          >
            <Bell size={19} />
            {unreadNotifications > 0 && <Badge count={unreadNotifications} />}
          </button>
          <button
            ref={desktopUpdatesTriggerRef}
            className="hv-icon"
            onClick={(e) =>
              updatesCollapsed ? openUpdates(e.currentTarget) : closeUpdates()
            }
            aria-label={
              updatesCollapsed
                ? "Open community updates"
                : "Close community updates"
            }
            aria-controls="community-updates-drawer"
            aria-expanded={!updatesCollapsed}
          >
            <Megaphone size={19} />
            {communityUpdatesCount > 0 && (
              <Badge count={communityUpdatesCount} />
            )}
          </button>
          <button
            className="hv-button hv-create-button"
            onClick={() => setCreateModalOpen(true)}
          >
            <Plus size={17} />
            <span>Create</span>
          </button>
          <Link to="/profile" className="hv-account" aria-label="Your profile">
            {profilePhoto ? (
              <img src={profilePhoto} alt="" />
            ) : (
              <User size={20} />
            )}
          </Link>
        </div>
      </header>
      <header className="app-mobile-header hv-mobile-topbar">
        <button
          ref={menuButtonRef}
          className="hv-icon"
          aria-label="Open navigation"
          aria-expanded={sidebarOpen}
          aria-controls="hv-mobile-menu"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={21} />
        </button>
        <Link className="hv-brand" to="/" aria-label="Hivez home">
          {brand}
        </Link>
        <div className="hv-mobile-actions">
          <button
            className="hv-icon"
            onClick={toggleTheme}
            aria-label={
              resolvedTheme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
          >
            {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            ref={mobileUpdatesTriggerRef}
            className="hv-icon"
            onClick={(e) =>
              updatesCollapsed ? openUpdates(e.currentTarget) : closeUpdates()
            }
            aria-label={
              updatesCollapsed
                ? "Open community updates"
                : "Close community updates"
            }
            aria-expanded={!updatesCollapsed}
            aria-controls="community-updates-drawer"
          >
            <Megaphone size={18} />
            {communityUpdatesCount > 0 && (
              <Badge count={communityUpdatesCount} />
            )}
          </button>
        </div>
      </header>
      <aside
        ref={sidebarRef}
        className="app-sidebar hv-sidebar"
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        <HiveNav
          collapsed={!isSidebarExpanded}
          unread={unreadNotifications}
          onNavigate={go}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => void logout()}
          onCreate={() => setCreateModalOpen(true)}
        />
      </aside>
      <dialog
        ref={mobileNavRef}
        id="hv-mobile-menu"
        className="hv-mobile-menu"
        aria-label="Navigation"
        onClick={(e) => {
          if (e.target === mobileNavRef.current) setSidebarOpen(false);
        }}
        onClose={() => {
          setSidebarOpen(false);
          menuButtonRef.current?.focus();
        }}
      >
        <div className="hv-mobile-menu-heading">
          <Link
            to="/"
            className="hv-brand"
            onClick={() => setSidebarOpen(false)}
          >
            {brand}
          </Link>
          <button
            className="hv-icon"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={19} />
          </button>
        </div>
        <HiveNav
          collapsed={false}
          unread={unreadNotifications}
          onNavigate={go}
          onClose={() => setSidebarOpen(false)}
          onLogout={() => void logout()}
          onCreate={() => {
            setSidebarOpen(false);
            setCreateModalOpen(true);
          }}
        />
      </dialog>
      <main id="hv-content" tabIndex={-1} className="app-main hv-main">
        <div className="app-feed-shell hv-content">
          <Outlet />
        </div>
      </main>
      <aside
        id="community-updates-drawer"
        hidden={updatesCollapsed}
        className="app-updates app-updates-drawer"
        aria-label="Community updates"
      >
        <UpdatesPanel
          onClose={closeUpdates}
          closeButtonRef={updatesCloseRef}
          onCountChange={setCommunityUpdatesCount}
        />
      </aside>
      <nav
        className="app-bottom-nav hv-bottom-nav"
        aria-label="Mobile navigation"
      >
        {[
          { to: "/", label: "Feed", icon: Home },
          { to: "/search", label: "Explore", icon: Search },
          { to: "create", label: "Create", icon: Plus },
          { to: "/chats", label: "Messages", icon: MessageCircle },
          { to: "/profile", label: "Profile", icon: User },
        ].map(({ to, label, icon: Icon }) => (
          <button
            key={to}
            className={
              to === "create"
                ? "hv-mobile-create"
                : isActive(to)
                  ? "is-active"
                  : ""
            }
            aria-current={isActive(to) ? "page" : undefined}
            onClick={() =>
              to === "create" ? setCreateModalOpen(true) : go(to)
            }
          >
            <Icon size={21} strokeWidth={1.7} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <CreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </div>
  );
}
