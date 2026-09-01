import { useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCheck,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  UserPlus,
  X,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import HivezLoader from "@/components/common/HivezLoader";
import { db } from "@/firebase/firebase";
import { ULTRA_BEE_ID, ULTRA_BEE_PROFILE, ULTRA_BEE_TAGLINE, ULTRA_BEE_WELCOME, ultraBeeChatIdFor } from "@/constants/ultraBee";
import { requestUltraBeeReply } from "@/services/ultraBee";

interface ChatUser {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  verified?: boolean;
  bio?: string;
}

interface ChatDoc {
  id: string;
  participants: string[];
  participantProfiles: Record<string, ChatUser>;
  lastMessage?: string;
  lastMessageAt?: any;
  lastMessageSenderId?: string;
  unreadCounts?: Record<string, number>;
  typing?: Record<string, boolean>;
}

interface MessageDoc {
  id: string;
  clientId?: string;
  text: string;
  senderId: string;
  createdAt?: any;
  readBy?: string[];
}

function chatIdFor(a: string, b: string) {
  return [a, b].sort().join("_");
}

function formatTime(timestamp: any) {
  if (!timestamp?.toDate) return "";
  return timestamp.toDate().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatListTime(timestamp: any) {
  if (!timestamp?.toDate) return "";
  const date = timestamp.toDate();
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return formatTime(timestamp);
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function localTimestamp(date = new Date()) {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    toDate: () => date,
  };
}

function serializeTimestamp(timestamp: any) {
  return timestamp?.toDate ? timestamp.toDate().getTime() : null;
}

function restoreTimestamp(value: any) {
  if (!value) return null;
  if (value?.toDate) return value;
  return localTimestamp(new Date(value));
}

export default function Chats() {
  const { user } = useAuth();
  const [me, setMe] = useState<ChatUser | null>(null);
  const [chats, setChats] = useState<ChatDoc[]>([]);
  const [localChats, setLocalChats] = useState<ChatDoc[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const [messages, setMessages] = useState<MessageDoc[]>([]);
  const [localMessages, setLocalMessages] = useState<Record<string, MessageDoc[]>>({});
  const [draftChat, setDraftChat] = useState<ChatDoc | null>(null);
  const [pendingMessages, setPendingMessages] = useState<Record<string, MessageDoc[]>>({});
  const [messageText, setMessageText] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [people, setPeople] = useState<ChatUser[]>([]);
  const [sending, setSending] = useState(false);
  const [ultraBeeThinking, setUltraBeeThinking] = useState(false);
  const [ultraBeeError, setUltraBeeError] = useState<string | null>(null);
  const [ultraBeeRetryText, setUltraBeeRetryText] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seededUltraChatsRef = useRef<Set<string>>(new Set());

  function localChatsKey(uid = user?.uid) {
    return uid ? `hivez-local-chats:${uid}` : "";
  }

  function localMessagesKey(uid = user?.uid) {
    return uid ? `hivez-local-messages:${uid}` : "";
  }

  function persistLocalChats(nextChats: ChatDoc[]) {
    if (!user) return;
    setLocalChats(nextChats);
    localStorage.setItem(
      localChatsKey(),
      JSON.stringify(
        nextChats.map((chat) => ({
          ...chat,
          lastMessageAt: serializeTimestamp(chat.lastMessageAt),
        }))
      )
    );
  }

  function upsertLocalChat(chat: ChatDoc) {
    const nextChats = [chat, ...localChats.filter((item) => item.id !== chat.id)];
    persistLocalChats(nextChats);
  }

  function persistLocalMessages(nextMessages: Record<string, MessageDoc[]>) {
    if (!user) return;
    setLocalMessages(nextMessages);
    localStorage.setItem(
      localMessagesKey(),
      JSON.stringify(
        Object.fromEntries(
          Object.entries(nextMessages).map(([chatId, chatMessages]) => [
            chatId,
            chatMessages.map((message) => ({
              ...message,
              createdAt: serializeTimestamp(message.createdAt),
            })),
          ])
        )
      )
    );
  }

  function addLocalMessage(chatId: string, message: MessageDoc) {
    persistLocalMessages({
      ...localMessages,
      [chatId]: [...(localMessages[chatId] || []).filter((item) => item.id !== message.id), message],
    });
  }

  useEffect(() => {
    if (!user) return;

    const storedChats = localStorage.getItem(localChatsKey(user.uid));
    if (storedChats) {
      const parsedChats = JSON.parse(storedChats) as ChatDoc[];
      const restoredChats = parsedChats.map((chat) => ({
        ...chat,
        lastMessageAt: restoreTimestamp(chat.lastMessageAt),
      }));
      setLocalChats(restoredChats);
      setSelectedChatId((current) => current || (window.innerWidth >= 768 ? restoredChats[0]?.id || null : current));
    }

    const storedMessages = localStorage.getItem(localMessagesKey(user.uid));
    if (storedMessages) {
      const parsedMessages = JSON.parse(storedMessages) as Record<string, MessageDoc[]>;
      setLocalMessages(
        Object.fromEntries(
          Object.entries(parsedMessages).map(([chatId, chatMessages]) => [
            chatId,
            chatMessages.map((message) => ({
              ...message,
              createdAt: restoreTimestamp(message.createdAt),
            })),
          ])
        )
      );
    }
  }, [user]);

  useEffect(() => {
    async function loadMe() {
      if (!user) return;
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.data();
      setMe({
        uid: user.uid,
        username: data?.username || user.email?.split("@")[0] || "user",
        displayName: data?.displayName || user.displayName || "Hivez User",
        photoURL: data?.photoURL || user.photoURL || "",
        verified: data?.verified || false,
        bio: data?.bio || "",
      });
    }
    loadMe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "chats"), (snapshot) => {
      const nextChats = snapshot.docs
        .map((chatDoc) => ({
          id: chatDoc.id,
          ...(chatDoc.data() as Omit<ChatDoc, "id">),
        }))
        .filter((chat) => chat.participants?.includes(user.uid))
        .sort((a, b) => {
          const aTime = a.lastMessageAt?.toDate?.().getTime?.() || 0;
          const bTime = b.lastMessageAt?.toDate?.().getTime?.() || 0;
          return bTime - aTime;
        });
      setChats(nextChats);
      if (nextChats.length) persistLocalChats(nextChats);
      setDraftChat((draft) => (draft && nextChats.some((chat) => chat.id === draft.id) ? null : draft));
      setSelectedChatId((current) => current || (window.innerWidth >= 768 ? nextChats[0]?.id || null : current));
    }, (error) => {
      console.error("Chat listener failed:", error);
    });
  }, [user]);

  useEffect(() => {
    if (!selectedChatId || !user) {
      setMessages([]);
      return;
    }

    const q = query(collection(db, "chats", selectedChatId, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const nextMessages = snapshot.docs.map((messageDoc) => ({
        id: messageDoc.id,
        ...(messageDoc.data() as Omit<MessageDoc, "id">),
      }));
      setMessages(nextMessages);
      const syncedClientIds = new Set(nextMessages.map((message) => message.clientId).filter(Boolean));
      if (syncedClientIds.size) {
        const nextLocalMessages = {
          ...localMessages,
          [selectedChatId]: (localMessages[selectedChatId] || []).filter((message) => !syncedClientIds.has(message.clientId || message.id)),
        };
        persistLocalMessages(nextLocalMessages);
        setPendingMessages((current) => ({
          ...current,
          [selectedChatId]: (current[selectedChatId] || []).filter((message) => !syncedClientIds.has(message.clientId || message.id)),
        }));
      }

      const unreadFromOthers = snapshot.docs.filter((messageDoc) => {
        const data = messageDoc.data() as MessageDoc;
        return data.senderId !== user.uid && !data.readBy?.includes(user.uid);
      });

      if (unreadFromOthers.length) {
        const batch = writeBatch(db);
        unreadFromOthers.forEach((messageDoc) => {
          batch.update(messageDoc.ref, { readBy: [...((messageDoc.data() as MessageDoc).readBy || []), user.uid] });
        });
        batch.update(doc(db, "chats", selectedChatId), { [`unreadCounts.${user.uid}`]: 0 });
        await batch.commit();
      }
    }, (error) => {
      console.error("Message listener failed:", error);
    });

    return unsubscribe;
  }, [selectedChatId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedChatId]);

  useEffect(() => {
    const trimmed = userSearch.trim().toLowerCase();
    if (!trimmed) {
      setPeople([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const snapshot = await getDocs(query(collection(db, "users"), limit(60)));
        const results: ChatUser[] = [];
        snapshot.forEach((userDoc) => {
          if (userDoc.id === user?.uid) return;
          const data = userDoc.data();
          const username = (data.username || "").toLowerCase();
          const displayName = (data.displayName || "").toLowerCase();
          if (username.includes(trimmed) || displayName.includes(trimmed)) {
            results.push({
              uid: userDoc.id,
              username: data.username || "",
              displayName: data.displayName || data.username || "Hivez User",
              photoURL: data.photoURL || "",
              verified: data.verified || false,
              bio: data.bio || "",
            });
          }
        });
        setPeople(results);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [userSearch, user?.uid]);

  const displayChats = useMemo(() => {
    const byId = new Map<string, ChatDoc>();
    localChats.forEach((chat) => byId.set(chat.id, chat));
    chats.forEach((chat) => byId.set(chat.id, chat));
    if (draftChat) byId.set(draftChat.id, { ...(byId.get(draftChat.id) || {}), ...draftChat });

    // Ultra Bee is a pinned system participant: always present, always on top,
    // using the existing ChatDoc shape so the normal chat UI renders it.
    let ultraEntry: ChatDoc | null = null;
    if (user) {
      const ultraChatId = ultraBeeChatIdFor(user.uid);
      const existing = byId.get(ultraChatId);
      const currentMe: ChatUser = me || {
        uid: user.uid,
        username: user.email?.split("@")[0] || "user",
        displayName: user.displayName || "Hivez User",
        photoURL: user.photoURL || "",
      };
      ultraEntry = {
        ...(existing || {
          id: ultraChatId,
          participants: [user.uid, ULTRA_BEE_ID],
          lastMessage: ULTRA_BEE_TAGLINE,
          lastMessageAt: null,
          lastMessageSenderId: "",
          unreadCounts: {},
        }),
        participantProfiles: {
          ...(existing?.participantProfiles || {}),
          [user.uid]: existing?.participantProfiles?.[user.uid] || currentMe,
          [ULTRA_BEE_ID]: ULTRA_BEE_PROFILE,
        },
      };
      byId.delete(ultraChatId);
    }

    const sorted = Array.from(byId.values()).sort((a, b) => {
      const aTime = a.lastMessageAt?.toDate?.().getTime?.() || 0;
      const bTime = b.lastMessageAt?.toDate?.().getTime?.() || 0;
      return bTime - aTime;
    });
    return ultraEntry ? [ultraEntry, ...sorted] : sorted;
  }, [chats, draftChat, localChats, me, user]);

  const selectedChat = displayChats.find((chat) => chat.id === selectedChatId) || null;
  const otherUser = useMemo(() => {
    if (!selectedChat || !user) return null;
    const otherId = selectedChat.participants.find((id) => id !== user.uid);
    return otherId ? selectedChat.participantProfiles?.[otherId] : null;
  }, [selectedChat, user]);

  const isUltraBeeChat = Boolean(user && selectedChat && selectedChat.id === ultraBeeChatIdFor(user.uid));

  async function startChat(person: ChatUser) {
    if (!user) return;
    const currentMe =
      me || {
        uid: user.uid,
        username: user.email?.split("@")[0] || "user",
        displayName: user.displayName || "Hivez User",
        photoURL: user.photoURL || "",
        verified: false,
      };
    const id = chatIdFor(user.uid, person.uid);
    const optimisticChat: ChatDoc = {
      id,
      participants: [user.uid, person.uid],
      participantProfiles: {
        [user.uid]: currentMe,
        [person.uid]: person,
      },
      lastMessage: "",
      lastMessageAt: null,
      lastMessageSenderId: "",
      unreadCounts: {
        [user.uid]: 0,
        [person.uid]: 0,
      },
    };

    setDraftChat(optimisticChat);
    upsertLocalChat(optimisticChat);
    setSelectedChatId(id);
    setMobileThreadOpen(true);
    setSearchOpen(false);
    setUserSearch("");
    setMessageText("");

    const chatRef = doc(db, "chats", id);

    try {
      const snap = await getDoc(chatRef);
      if (!snap.exists()) {
        const { id: _id, ...chatData } = optimisticChat;
        await setDoc(chatRef, {
          ...chatData,
          lastMessageAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Failed to start chat:", error);
    }
  }

  async function sendMessage() {
    const text = messageText.trim();
    if (!text || !user || !selectedChat || sending) return;

    const recipientId = selectedChat.participants.find((id) => id !== user.uid);
    if (!recipientId) return;

    setSending(true);
    setMessageText("");
    const clientId = `client-${user.uid}-${Date.now()}`;
    const optimisticMessage: MessageDoc = {
      id: clientId,
      clientId,
      text,
      senderId: user.uid,
      createdAt: localTimestamp(),
      readBy: [user.uid],
    };
    addLocalMessage(selectedChat.id, optimisticMessage);

    setPendingMessages((current) => ({
      ...current,
      [selectedChat.id]: [...(current[selectedChat.id] || []), optimisticMessage],
    }));

    const optimisticChat: ChatDoc = {
      ...selectedChat,
      lastMessage: text,
      lastMessageAt: optimisticMessage.createdAt,
      lastMessageSenderId: user.uid,
      unreadCounts: {
        ...(selectedChat.unreadCounts || {}),
        [user.uid]: selectedChat.unreadCounts?.[user.uid] || 0,
        [recipientId]: (selectedChat.unreadCounts?.[recipientId] || 0) + 1,
      },
    };
    setDraftChat(optimisticChat);
    upsertLocalChat(optimisticChat);

    try {
      const { id: _id, ...chatData } = selectedChat;
      await setDoc(
        doc(db, "chats", selectedChat.id),
        {
          ...chatData,
          lastMessage: text,
          lastMessageAt: serverTimestamp(),
          lastMessageSenderId: user.uid,
          [`unreadCounts.${recipientId}`]: increment(1),
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      await addDoc(collection(db, "chats", selectedChat.id, "messages"), {
        clientId,
        text,
        senderId: user.uid,
        createdAt: serverTimestamp(),
        readBy: [user.uid],
      });

      await updateDoc(doc(db, "chats", selectedChat.id), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
      });
      setPendingMessages((current) => ({
        ...current,
        [selectedChat.id]: (current[selectedChat.id] || []).filter((message) => message.clientId !== clientId),
      }));

      if (selectedChat.participants.includes(ULTRA_BEE_ID)) {
        await runUltraBeeTurn(selectedChat.id, text);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }

  async function runUltraBeeTurn(chatId: string, userText: string) {
    if (!user) return;
    const currentMe: ChatUser = me || {
      uid: user.uid,
      username: user.email?.split("@")[0] || "user",
      displayName: user.displayName || "Hivez User",
      photoURL: user.photoURL || "",
    };

    setUltraBeeThinking(true);
    setUltraBeeError(null);
    setUltraBeeRetryText(null);

    try {
      const history = messages
        .filter((message) => !message.clientId && message.text.trim())
        .slice(-20)
        .map((message) => ({
          role: message.senderId === user.uid ? ("user" as const) : ("assistant" as const),
          content: message.text,
        }));

      const result = await requestUltraBeeReply({
        context: {
          uid: user.uid,
          displayName: currentMe.displayName,
          username: currentMe.username,
        },
        history: [...history, { role: "user", content: userText }],
      });

      if (!result.ok) throw new Error(result.error);

      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: result.reply,
        senderId: ULTRA_BEE_ID,
        createdAt: serverTimestamp(),
        readBy: [user.uid],
      });

      await updateDoc(doc(db, "chats", chatId), {
        lastMessage: result.reply,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: ULTRA_BEE_ID,
      });
    } catch (error) {
      console.error("Ultra Bee request failed:", error);
      setUltraBeeError("Sorry, Ultra Bee couldn't respond right now. Please try again.");
      setUltraBeeRetryText(userText);
    } finally {
      setUltraBeeThinking(false);
    }
  }

  async function retryUltraBeeTurn() {
    if (!selectedChat || !ultraBeeRetryText || ultraBeeThinking) return;
    await runUltraBeeTurn(selectedChat.id, ultraBeeRetryText);
  }

  /** Lazily creates the Ultra Bee chat doc + greeting on first open (per session). */
  async function openUltraBeeChat(chatId: string) {
    if (!user || seededUltraChatsRef.current.has(chatId)) return;
    seededUltraChatsRef.current.add(chatId);

    try {
      const chatRef = doc(db, "chats", chatId);
      const snap = await getDoc(chatRef);
      if (snap.exists()) return;

      const currentMe: ChatUser = me || {
        uid: user.uid,
        username: user.email?.split("@")[0] || "user",
        displayName: user.displayName || "Hivez User",
        photoURL: user.photoURL || "",
      };

      await setDoc(chatRef, {
        participants: [user.uid, ULTRA_BEE_ID],
        participantProfiles: {
          [user.uid]: currentMe,
          [ULTRA_BEE_ID]: ULTRA_BEE_PROFILE,
        },
        lastMessage: ULTRA_BEE_WELCOME,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: ULTRA_BEE_ID,
        unreadCounts: { [user.uid]: 0 },
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: ULTRA_BEE_WELCOME,
        senderId: ULTRA_BEE_ID,
        createdAt: serverTimestamp(),
        readBy: [user.uid],
      });
    } catch (error) {
      console.error("Failed to prepare Ultra Bee chat:", error);
    }
  }

  const showThreadOnMobile = Boolean(selectedChatId && mobileThreadOpen);

  return (
    <div className="w-full min-h-[calc(100vh-64px)] bg-[#f7f7f2] font-sans text-[#1c1d1a] selection:bg-[#3d654c]/20 selection:text-[#2d4d38] dark:bg-[#0a0a0a] dark:text-neutral-100 fixed inset-0 top-[64px] bottom-[64px] md:static md:inset-auto md:h-[calc(100vh-64px)] overflow-hidden select-none">
      <div className="flex h-full w-full">
        {/* Sidebar Chat List */}
        <aside className={`${showThreadOnMobile ? "hidden md:flex" : "flex"} relative w-full flex-col md:w-80 lg:w-[340px] border-r border-[#1c1d1a]/10 bg-white dark:border-neutral-800 dark:bg-[#121212]`}>
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <div>
              <h1 className="text-lg font-black tracking-tight text-[#1c1d1a] dark:text-white">Direct Messages</h1>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#3d654c] dark:text-[#f2c14e]">
                Citizen Triage Network
              </p>
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden md:flex h-8 w-8 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#3d654c] transition hover:bg-[#ecece5] dark:border-neutral-800 dark:bg-[#181818] dark:text-[#f2c14e]"
              title="New Chat"
            >
              <UserPlus size={16} />
            </button>
          </div>

          <div className="px-3 pb-3">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] px-3.5 py-2.5 text-left text-xs font-medium text-[#1c1d1a]/60 dark:border-neutral-800 dark:bg-[#181818] dark:text-neutral-400 transition hover:border-[#3d654c]/30"
            >
              <Search size={15} className="text-[#3d654c] dark:text-[#f2c14e]" />
              <span>Search people to message...</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-24 md:pb-3 space-y-1">
            {displayChats.length === 0 ? (
              <div className="mx-2 mt-8 rounded-2xl border border-[#1c1d1a]/10 bg-[#f7f7f2] px-5 py-8 text-center dark:border-neutral-800 dark:bg-[#181818]">
                <MessageCircle size={32} className="mx-auto mb-2 text-[#3d654c] dark:text-[#f2c14e]" />
                <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">No active chats</p>
                <p className="mt-0.5 text-[11px] text-[#1c1d1a]/60 dark:text-neutral-400">Search someone to initiate a direct message.</p>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#3d654c] px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-[#32533e] dark:bg-[#f2c14e] dark:text-[#121212] dark:hover:bg-[#dfb041]"
                >
                  <UserPlus size={14} /> New Chat
                </button>
              </div>
            ) : (
              displayChats.map((chat) => {
                const otherId = chat.participants.find((id) => id !== user?.uid);
                const person = otherId ? chat.participantProfiles?.[otherId] : null;
                const unread = user ? chat.unreadCounts?.[user.uid] || 0 : 0;
                return (
                  <button
                    key={chat.id}
                    onClick={() => {
                      setSelectedChatId(chat.id);
                      setMobileThreadOpen(true);
                      setUltraBeeError(null);
                      setUltraBeeRetryText(null);
                      if (chat.participants.includes(ULTRA_BEE_ID)) void openUltraBeeChat(chat.id);
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-all ${
                      selectedChatId === chat.id
                        ? "bg-[#3d654c]/10 dark:bg-[#f2c14e]/10 border border-[#3d654c]/20 dark:border-[#f2c14e]/20"
                        : "hover:bg-[#1c1d1a]/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <Avatar user={person} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="truncate text-xs font-bold text-[#1c1d1a] dark:text-white">
                          {person?.displayName || "Hivez User"}
                        </p>
                        <span className="shrink-0 text-[10px] font-bold text-[#1c1d1a]/40 dark:text-neutral-500">
                          {formatListTime(chat.lastMessageAt)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-1">
                        <p className={`truncate text-[11px] ${unread ? "font-bold text-[#1c1d1a] dark:text-white" : "text-[#1c1d1a]/60 dark:text-neutral-400"}`}>
                          {chat.lastMessage || `@${person?.username || "user"}`}
                        </p>
                        {unread > 0 && (
                          <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#3d654c] px-1 text-[10px] font-bold text-white dark:bg-[#f2c14e] dark:text-[#121212]">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <button
            onClick={() => setSearchOpen(true)}
            className="absolute bottom-16 right-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#3d654c] text-white shadow-lg transition active:scale-95 dark:bg-[#f2c14e] dark:text-[#121212] md:hidden z-10"
          >
            <UserPlus size={20} />
          </button>
        </aside>

        {/* Message Thread Viewport */}
        <section className={`${showThreadOnMobile ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col relative bg-[#f7f7f2] dark:bg-[#0a0a0a]`}>
          {selectedChat && otherUser ? (
            <>
              {/* Thread Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-[#1c1d1a]/10 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-[#121212]">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    onClick={() => setMobileThreadOpen(false)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] text-[#1c1d1a] dark:border-neutral-800 dark:bg-[#181818] dark:text-white md:hidden"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <Avatar user={otherUser} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="truncate text-xs font-bold text-[#1c1d1a] dark:text-white">
                        {otherUser.displayName || otherUser.username}
                      </h2>
                      {otherUser.verified && <BadgeCheck size={14} className="text-[#3d654c] dark:text-[#f2c14e]" />}
                    </div>
                    <p className="truncate text-[10px] font-medium text-[#1c1d1a]/50 dark:text-neutral-400">
                      @{otherUser.username}
                    </p>
                  </div>
                </div>
                <button className="flex h-8 w-8 items-center justify-center rounded-xl text-[#1c1d1a]/60 hover:bg-[#1c1d1a]/5 dark:text-neutral-400 dark:hover:bg-white/10">
                  <MoreHorizontal size={18} />
                </button>
              </div>

              {/* Message List */}
              <div className="flex-1 min-h-0 space-y-2 overflow-y-auto px-4 py-4 bg-[#f7f7f2] dark:bg-[#0a0a0a] pb-24 md:pb-6">
                {[
                  ...new Map(
                    [...localMessages[selectedChat.id] || [], ...pendingMessages[selectedChat.id] || [], ...messages]
                      .map((message) => [message.clientId || message.id, message])
                  ).values(),
                ].map((message, index, visibleMessages) => {
                  const mine = message.senderId === user?.uid;
                  const previous = visibleMessages[index - 1];
                  const showTime = !previous || (message.createdAt?.seconds || 0) - (previous.createdAt?.seconds || 0) > 900;
                  const read = Boolean(user && message.readBy?.some((uid) => uid !== user.uid));
                  return (
                    <div key={message.id}>
                      {showTime && (
                        <div className="my-3 text-center text-[10px] font-bold uppercase tracking-wider text-[#1c1d1a]/40 dark:text-neutral-500">
                          {message.createdAt?.toDate?.().toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          }) || "Sending"}
                        </div>
                      )}
                      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                          <div
                            className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-2xs ${
                              mine
                                ? "rounded-br-xs bg-[#3d654c] text-white dark:bg-[#f2c14e] dark:text-[#121212]"
                                : "rounded-bl-xs bg-white text-[#1c1d1a] border border-[#1c1d1a]/10 dark:border-neutral-800 dark:bg-[#121212] dark:text-white"
                            }`}
                          >
                            {message.text}
                          </div>
                          <div className="mt-1 flex items-center gap-1 px-1 text-[10px] font-bold text-[#1c1d1a]/40 dark:text-neutral-500">
                            <span>{formatTime(message.createdAt)}</span>
                            {mine && (read ? <CheckCheck size={12} className="text-[#3d654c] dark:text-[#f2c14e]" /> : <Check size={12} />)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isUltraBeeChat && ultraBeeThinking && (
                  <div className="flex items-center gap-2 pl-1">
                    <HivezLoader size="sm" progress={58} label="Ultra Bee is thinking" />
                    <span className="text-[11px] font-bold text-[#1c1d1a]/50 dark:text-neutral-400">Ultra Bee is thinking…</span>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Chat Input Bar (Safely padded above mobile bottom navigation) */}
              <div className="absolute bottom-0 left-0 right-0 shrink-0 border-t border-[#1c1d1a]/10 bg-white p-3 dark:border-neutral-800 dark:bg-[#121212] pb-[76px] md:pb-3 z-20">
                {isUltraBeeChat && ultraBeeError && (
                  <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] px-3 py-2 dark:border-neutral-800 dark:bg-[#181818]">
                    <p className="text-[11px] font-bold text-[#1c1d1a]/70 dark:text-neutral-300">{ultraBeeError}</p>
                    <button
                      onClick={retryUltraBeeTurn}
                      disabled={ultraBeeThinking}
                      className="shrink-0 text-[10px] font-black uppercase tracking-wider text-[#3d654c] transition hover:opacity-80 disabled:opacity-40 dark:text-[#f2c14e]"
                    >
                      Retry
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2 rounded-2xl border border-[#1c1d1a]/15 bg-[#f7f7f2] p-2 dark:border-neutral-800 dark:bg-[#181818]">
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    rows={1}
                    placeholder={`Message ${otherUser.displayName || otherUser.username}...`}
                    className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-xs font-medium text-[#1c1d1a] placeholder:text-[#1c1d1a]/40 outline-none dark:text-white dark:placeholder:text-neutral-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageText.trim() || sending}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3d654c] text-white shadow-2xs transition hover:bg-[#32533e] disabled:opacity-40 dark:bg-[#f2c14e] dark:text-[#121212] dark:hover:bg-[#dfb041]"
                  >
                    {sending ? <HivezLoader size="sm" progress={76} label="Sending" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="hidden flex-1 items-center justify-center px-6 md:flex">
              <div className="max-w-xs rounded-3xl border border-[#1c1d1a]/10 bg-white p-8 text-center shadow-xs dark:border-neutral-800 dark:bg-[#121212]">
                <MessageCircle size={36} className="mx-auto mb-3 text-[#3d654c] dark:text-[#f2c14e]" />
                <h2 className="text-sm font-bold text-[#1c1d1a] dark:text-white">Direct Messaging</h2>
                <p className="mt-1 text-xs text-[#1c1d1a]/60 dark:text-neutral-400">Select an active conversation or search a citizen to chat.</p>
                <button
                  onClick={() => setSearchOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#3d654c] px-4 py-2 text-xs font-bold text-white shadow-2xs transition hover:bg-[#32533e] dark:bg-[#f2c14e] dark:text-[#121212] dark:hover:bg-[#dfb041]"
                >
                  <UserPlus size={14} /> Start Chat
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* New Chat Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-20 backdrop-blur-xs">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#1c1d1a]/10 bg-white shadow-2xl dark:border-neutral-800 dark:bg-[#121212]">
            <div className="flex items-center justify-between border-b border-[#1c1d1a]/10 px-4 py-3.5 dark:border-neutral-800">
              <h2 className="text-xs font-black uppercase tracking-wider text-[#1c1d1a] dark:text-white">New Direct Message</h2>
              <button
                onClick={() => setSearchOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f7f7f2] text-[#1c1d1a] transition hover:bg-[#ecece5] dark:bg-[#1a1a1a] dark:text-white"
              >
                <X size={15} />
              </button>
            </div>
            <div className="p-3 border-b border-[#1c1d1a]/5 dark:border-neutral-800/60">
              <div className="flex items-center gap-2 rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] px-3.5 py-2.5 dark:border-neutral-800 dark:bg-[#181818]">
                <Search size={15} className="text-[#3d654c] dark:text-[#f2c14e]" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  autoFocus
                  placeholder="Search citizen by name or username..."
                  className="flex-1 bg-transparent text-xs font-medium text-[#1c1d1a] placeholder:text-[#1c1d1a]/40 outline-none dark:text-white dark:placeholder:text-neutral-500"
                />
              </div>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {searching ? (
                <div className="flex justify-center py-8">
                  <HivezLoader size="sm" progress={62} label="Searching citizens" />
                </div>
              ) : people.length ? (
                people.map((person) => (
                  <button
                    key={person.uid}
                    onClick={() => startChat(person)}
                    className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-[#1c1d1a]/5 dark:hover:bg-white/5"
                  >
                    <Avatar user={person} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-bold text-[#1c1d1a] dark:text-white">{person.displayName}</p>
                        {person.verified && <BadgeCheck size={14} className="text-[#3d654c] dark:text-[#f2c14e]" />}
                      </div>
                      <p className="text-[10px] font-bold text-[#1c1d1a]/50 dark:text-neutral-400">@{person.username}</p>
                      {person.bio && <p className="mt-0.5 truncate text-[11px] text-[#1c1d1a]/70 dark:text-neutral-300">{person.bio}</p>}
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-12 text-center">
                  <Sparkles size={28} className="mx-auto mb-2 text-[#3d654c] dark:text-[#f2c14e]" />
                  <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">{userSearch ? "No citizens found" : "Search to start chat"}</p>
                  <p className="mt-0.5 text-[11px] text-[#1c1d1a]/50 dark:text-neutral-400">Type a name or username to message.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ user }: { user?: ChatUser | null }) {
  const name = user?.displayName || user?.username || "Hivez";
  return (
    <img
      src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=3d654c&color=fff`}
      alt={name}
      className="h-10 w-10 shrink-0 rounded-full object-cover border border-[#1c1d1a]/10 dark:border-neutral-700 shadow-2xs"
    />
  );
}