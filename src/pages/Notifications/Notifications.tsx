import { useEffect, useMemo, useState } from "react";
import { AtSign, Heart, MessageCircle, Repeat2, UserPlus, Check, X, Megaphone, Bell, Sparkles } from "lucide-react";
import HivezLoader from "@/components/common/HivezLoader";
import { useNavigate } from "react-router-dom";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "@/firebase/firebase";

import { useAuth } from "@/context/AuthContext";
import { useLiveProfiles } from "@/hooks/useLiveProfile";
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
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return timestamp.toDate().toLocaleDateString([], { month: "short", day: "numeric" });
}

function iconFor(type: NotificationDoc["type"]) {
  if (type === "comment") return <MessageCircle size={14} className="text-sky-500" />;
  if (type === "follow") return <UserPlus size={14} className="text-emerald-500 dark:text-[#f2c14e]" />;
  if (type === "broadcast") return <Megaphone size={14} className="text-amber-500" />;
  if (type === "message") return <MessageCircle size={14} className="text-emerald-500" />;
  if (type === "rehive") return <Repeat2 size={14} className="text-emerald-500" />;
  if (type === "mention") return <AtSign size={14} className="text-sky-500" />;
  return <Heart size={14} className="fill-rose-500 text-rose-500" />;
}

function titleFor(notification: NotificationDoc, actorName?: string) {
  const name = actorName || notification.actorDisplayName || notification.actorUsername || "Someone";
  if (notification.type === "comment") return `${name} commented on your post`;
  if (notification.type === "follow") return `${name} sent you a follow request`;
  if (notification.type === "broadcast") return `${notification.actorDisplayName || "Hivez Official"}`;
  if (notification.type === "message") return `${name} sent you a message`;
  if (notification.type === "rehive") return `${name} ReHived your post`;
  if (notification.type === "mention") return `${name} mentioned you in a comment`;
  return `${name} liked your post`;
}

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  // Live actor profiles: notification docs store creation-time snapshots, this
  // keeps names/avatars current when the actor updates their profile.
  const actorIds = useMemo(
    () => [...new Set(notifications.map((n) => n.actorId).filter(Boolean))].slice(0, 50),
    [notifications]
  );
  const liveActors = useLiveProfiles(actorIds);

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
    setActionLoadingId(notification.id);
    
    try {
      await acceptFollowRequest(notification.actorId, user.uid);
      try { await deleteDoc(doc(db, "notifications", notification.id)); } catch {}
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    } catch (error) {
      console.error("Failed to accept follow request:", error);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleDeclineFollowRequest(notification: NotificationDoc, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;
    setActionLoadingId(notification.id);
    
    try {
      await declineFollowRequest(notification.actorId, user.uid);
      try { await deleteDoc(doc(db, "notifications", notification.id)); } catch {}
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    } catch (error) {
      console.error("Failed to decline follow request:", error);
    } finally {
      setActionLoadingId(null);
    }
  }

  async function markAllRead() {
    if (!user || unreadCount === 0) return;
    await markAllNotificationsRead(user.uid);
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center py-32">
        <HivezLoader size="md" progress={58} label="Loading notifications" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen px-4 py-5 md:px-6 space-y-4 select-none">
      {/* Top Banner Navigation Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#1c1d1a]/10 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-white text-[#3d654c] shadow-2xs dark:border-neutral-800 dark:bg-[#121212] dark:text-[#f2c14e]">
            <Bell size={18} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-[#1c1d1a] dark:text-white">Notifications</h1>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#3d654c] dark:text-[#f2c14e]">
              {unreadCount ? `${unreadCount} unread alerts` : "All caught up"}
            </p>
          </div>
        </div>

        <button
          onClick={markAllRead}
          disabled={!unreadCount}
          className="rounded-full border border-[#3d654c]/20 bg-[#3d654c]/10 px-3.5 py-1 text-xs font-bold text-[#3d654c] transition hover:bg-[#3d654c]/20 disabled:opacity-40 disabled:hover:bg-[#3d654c]/10 dark:border-[#f2c14e]/25 dark:bg-[#f2c14e]/10 dark:text-[#f2c14e] dark:hover:bg-[#f2c14e]/20"
        >
          Mark all read
        </button>
      </div>

      {/* Notifications List Container */}
      <div className="w-full space-y-2.5 pb-16">
        {notifications.length === 0 ? (
          <div className="flex min-h-[40vh] flex-col items-center justify-center px-8 text-center rounded-2xl border border-[#1c1d1a]/10 bg-white dark:border-neutral-800/90 dark:bg-[#121212] p-8 shadow-xs">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f7f7f2] text-[#1c1d1a]/30 dark:bg-[#1a1a1a] dark:text-neutral-500 mb-3">
              <Sparkles size={24} />
            </div>
            <h2 className="text-sm font-bold text-[#1c1d1a] dark:text-white">No notifications yet</h2>
            <p className="mt-1 text-xs font-medium text-[#1c1d1a]/60 dark:text-neutral-400 max-w-xs">
              When citizens interact with your triage posts or send follow requests, they will show up right here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const isUnread = !notification.read;
              const liveActor = liveActors[notification.actorId];
              const actorName = liveActor?.displayName || notification.actorDisplayName || notification.actorUsername || "Someone";
              const actorPhoto = liveActor?.photoURL || notification.actorPhotoURL;
              return (
                <button
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className={`group relative flex w-full gap-3.5 rounded-2xl border p-3.5 text-left transition-all duration-200 ${
                    isUnread
                      ? "border-[#3d654c]/30 bg-white shadow-2xs dark:border-[#f2c14e]/30 dark:bg-[#141414]"
                      : "border-[#1c1d1a]/10 bg-white/70 hover:bg-white dark:border-neutral-800/80 dark:bg-[#101010] dark:hover:bg-[#141414]"
                  }`}
                >
                  {/* Actor Avatar */}
                  <div className="relative shrink-0">
                    <img
                      src={
                        actorPhoto ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(actorName || "Hivez")}&background=3d654c&color=fff`
                      }
                      alt={actorName || "Actor"}
                      className="h-10 w-10 rounded-full object-cover border border-[#1c1d1a]/10 dark:border-neutral-700 shadow-2xs"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white shadow-2xs dark:bg-[#181818] border border-[#1c1d1a]/10 dark:border-neutral-700">
                      {iconFor(notification.type)}
                    </div>
                  </div>

                  {/* Content Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-[#1c1d1a] dark:text-white">
                          {titleFor(notification, actorName)}
                        </p>
                        {notification.text && (
                          <p className="mt-0.5 line-clamp-2 text-xs font-medium text-[#1c1d1a]/70 dark:text-neutral-300">
                            {notification.text}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2 pt-0.5">
                        <span className="text-[10px] font-bold text-[#1c1d1a]/40 dark:text-neutral-500">
                          {timeAgo(notification.createdAt)}
                        </span>
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-[#3d654c] dark:bg-[#f2c14e] shadow-2xs" />
                        )}
                      </div>
                    </div>

                    {/* Follow Request Actions */}
                    {notification.type === "follow" && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <button
                          onClick={(e) => handleAcceptFollowRequest(notification, e)}
                          disabled={actionLoadingId === notification.id}
                          className="inline-flex items-center gap-1 rounded-xl bg-[#3d654c] px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#32533e] disabled:opacity-50 dark:bg-[#f2c14e] dark:text-[#121212] dark:hover:bg-[#dfb041]"
                        >
                          <Check size={13} />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={(e) => handleDeclineFollowRequest(notification, e)}
                          disabled={actionLoadingId === notification.id}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#1c1d1a]/15 bg-[#f7f7f2] px-3 py-1.5 text-xs font-bold text-[#1c1d1a] shadow-2xs transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:border-neutral-700 dark:bg-[#1a1a1a] dark:text-neutral-300 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                        >
                          <X size={13} />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
