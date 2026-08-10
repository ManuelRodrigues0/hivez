import { useEffect, useMemo, useState } from "react";
import { Heart, Loader2, MessageCircle, UserPlus, Check, X, Megaphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/firebase/firebase";

import { useAuth } from "@/context/AuthContext";
import {
  listenToNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDoc,
} from "@/services/notifications";
import { acceptFollowRequest, declineFollowRequest } from "@/services/followRequests";

function timeAgo(timestamp: any) {
  if (!timestamp?.toDate) return "Now";
  const seconds = Math.floor((Date.now() - timestamp.toDate().getTime()) / 1000);
  if (seconds < 60) return "Now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return timestamp.toDate().toLocaleDateString([], { month: "short", day: "numeric" });
}

function iconFor(type: NotificationDoc["type"]) {
  if (type === "comment") return <MessageCircle size={18} className="text-sky-500" />;
  if (type === "follow") return <UserPlus size={18} className="text-emerald-500" />;
  if (type === "broadcast") return <Megaphone size={18} className="text-amber-500" />;
  if (type === "message") return <MessageCircle size={18} className="text-emerald-500" />;
  return <Heart size={18} className="fill-red-500 text-red-500" />;
}

function titleFor(notification: NotificationDoc) {
  const name = notification.actorDisplayName || notification.actorUsername || "Someone";
  if (notification.type === "comment") return `${name} commented on your post`;
  if (notification.type === "follow") return `${name} sent you a follow request`;
  if (notification.type === "broadcast") return `📢 ${notification.actorDisplayName || "Hivez"}`;
  if (notification.type === "message") return `${name} sent you a message`;
  return `${name} liked your post`;
}

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    return listenToNotifications(
      user.uid,
      (nextNotifications) => {
        setNotifications(nextNotifications);
        setLoading(false);
      },
      (error) => {
        console.error("Notifications listener failed:", error);
        setLoading(false);
      }
    );
  }, [user]);

  async function openNotification(notification: NotificationDoc) {
    if (!notification.read) {
      await markNotificationRead(notification.id);
    }
    navigate(notification.link || "/notifications");
  }

  async function handleAcceptFollowRequest(notification: NotificationDoc, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    
    try {
      await acceptFollowRequest(notification.actorId, user.uid);
      // Delete the notification so it doesn't reappear after refresh
      try { await deleteDoc(doc(db, "notifications", notification.id)); } catch {}
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    } catch (error) {
      console.error("Failed to accept follow request:", error);
    }
  }

  async function handleDeclineFollowRequest(notification: NotificationDoc, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    
    try {
      await declineFollowRequest(notification.actorId, user.uid);
      // Delete the notification so it doesn't reappear after refresh
      try { await deleteDoc(doc(db, "notifications", notification.id)); } catch {}
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    } catch (error) {
      console.error("Failed to decline follow request:", error);
    }
  }

  async function markAllRead() {
    if (!user || unreadCount === 0) return;
    await markAllNotificationsRead(user.uid);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-zinc-500 dark:text-zinc-400">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <section className="app-notifications-page min-h-[calc(100vh-64px)]">
      <div className="app-sticky-header flex items-center justify-between px-4 py-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {unreadCount ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <button
          onClick={markAllRead}
          disabled={!unreadCount}
          className="rounded-full px-4 py-2 text-sm font-semibold text-sky-600 transition hover:bg-sky-50 disabled:text-zinc-400 disabled:hover:bg-transparent dark:text-sky-400 dark:hover:bg-sky-950/30"
        >
          Mark all read
        </button>
      </div>

      {notifications.length === 0 ? (
        <div className="flex min-h-[48vh] items-center justify-center px-8 text-center">
          <div>
            <Heart size={40} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-700" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">No notifications yet</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Comments, likes, and follows will show up here.
            </p>
          </div>
        </div>
      ) : (
        <div>
          {notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => openNotification(notification)}
              className={`flex w-full gap-3 border-b border-zinc-200 px-4 py-4 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50 ${
                notification.read ? "" : "bg-sky-50/70 dark:bg-sky-950/20"
              }`}
            >
              <img
                src={
                  notification.actorPhotoURL ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.actorDisplayName || "Hivez")}&background=27272a&color=fff`
                }
                alt={notification.actorDisplayName}
                className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">{titleFor(notification)}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{notification.text}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {iconFor(notification.type)}
                    {!notification.read && <span className="h-2 w-2 rounded-full bg-sky-500" />}
                  </div>
                </div>
                {notification.type === "follow" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={(e) => handleAcceptFollowRequest(notification, e)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-600"
                    >
                      <Check size={14} />
                      Accept
                    </button>
                    <button
                      onClick={(e) => handleDeclineFollowRequest(notification, e)}
                      className="flex items-center gap-1.5 rounded-lg bg-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <X size={14} />
                      Decline
                    </button>
                  </div>
                )}
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">{timeAgo(notification.createdAt)}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
