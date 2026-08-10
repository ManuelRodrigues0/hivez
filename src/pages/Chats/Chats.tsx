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
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Search,
  Send,
  UserPlus,
  X,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/firebase/firebase";

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
  const bottomRef = useRef<HTMLDivElement>(null);

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
    return Array.from(byId.values()).sort((a, b) => {
      const aTime = a.lastMessageAt?.toDate?.().getTime?.() || 0;
      const bTime = b.lastMessageAt?.toDate?.().getTime?.() || 0;
      return bTime - aTime;
    });
  }, [chats, draftChat, localChats]);

  const selectedChat = displayChats.find((chat) => chat.id === selectedChatId) || null;
  const otherUser = useMemo(() => {
    if (!selectedChat || !user) return null;
    const otherId = selectedChat.participants.find((id) => id !== user.uid);
    return otherId ? selectedChat.participantProfiles?.[otherId] : null;
  }, [selectedChat, user]);

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
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }

  const showThreadOnMobile = Boolean(selectedChatId && mobileThreadOpen);

  return (
    <div className="app-chats-page fixed inset-0 top-[64px] bottom-[44px] overflow-hidden md:static md:inset-auto md:h-[calc(100vh-64px)] md:app-page">
      <div className="flex h-full">
        <aside className={`${showThreadOnMobile ? "hidden md:flex" : "flex"} relative w-full flex-col md:w-80 lg:w-[340px]`}>
          <div className="flex items-center justify-between px-4 pb-3 pt-5 md:pt-5">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white md:text-xl">Chats</h1>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">Private conversations</p>
            </div>
            <button onClick={() => setSearchOpen(true)} className="app-icon-button hidden md:inline-flex">
              <UserPlus size={20} />
            </button>
          </div>

          <div className="px-4 pb-3 md:px-3 md:pb-4">
            <button onClick={() => setSearchOpen(true)} className="flex w-full items-center gap-2 rounded-full bg-zinc-100 px-4 py-3 text-left text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400 md:py-2.5">
              <Search size={17} />
              Search people to message
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-24 md:pb-3">
            {displayChats.length === 0 ? (
              <div className="mx-2 mt-8 rounded-3xl bg-zinc-50 px-5 py-10 text-center dark:bg-zinc-950">
                <MessageCircle size={36} className="mb-3 text-zinc-300 dark:text-zinc-600" />
                <p className="font-semibold text-zinc-900 dark:text-white">No chats yet</p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Search someone and start a conversation.</p>
                <button onClick={() => setSearchOpen(true)} className="app-primary-button mt-5">
                  <UserPlus size={16} />
                  New chat
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
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      selectedChatId === chat.id ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-950"
                    }`}
                  >
                    <Avatar user={person} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-base font-semibold text-zinc-900 dark:text-white md:text-sm">{person?.displayName || "Hivez User"}</p>
                        <span className="flex-shrink-0 text-xs text-zinc-500">{formatListTime(chat.lastMessageAt)}</span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <p className={`truncate text-sm ${unread ? "font-semibold text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}>
                          {chat.lastMessage || `@${person?.username || "user"}`}
                        </p>
                        {unread > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-500 px-1.5 text-[11px] font-bold text-white">
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
            className="absolute bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-xl transition active:scale-95 dark:bg-white dark:text-black md:hidden"
          >
            <UserPlus size={22} />
          </button>
        </aside>

        <section className={`${showThreadOnMobile ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col relative`}>
          {selectedChat && otherUser ? (
            <>
              <div className="flex-shrink-0 flex items-center justify-between px-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <button onClick={() => setMobileThreadOpen(false)} className="app-icon-button md:hidden">
                    <ArrowLeft size={20} />
                  </button>
                  <Avatar user={otherUser} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{otherUser.displayName || otherUser.username}</h2>
                      {otherUser.verified && <BadgeCheck size={14} className="text-sky-500" />}
                    </div>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">@{otherUser.username}</p>
                  </div>
                </div>
                <button className="app-icon-button">
                  <MoreHorizontal size={20} />
                </button>
              </div>

              <div className="flex-1 min-h-0 space-y-2 overflow-y-auto rounded-t-[28px] bg-zinc-50 px-4 py-4 dark:bg-zinc-950/60">
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
                        <div className="my-4 text-center text-xs text-zinc-400">
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
                            className={`rounded-3xl px-4 py-2.5 text-sm leading-5 shadow-sm ${
                              mine
                                ? "rounded-br-lg bg-zinc-900 text-white dark:bg-white dark:text-black"
                                : "rounded-bl-lg bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-white"
                            }`}
                          >
                            {message.text}
                          </div>
                          <div className="mt-1 flex items-center gap-1 px-1 text-[11px] text-zinc-400">
                            <span>{formatTime(message.createdAt)}</span>
                            {mine && (read ? <CheckCheck size={13} className="text-sky-500" /> : <Check size={13} />)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="flex-shrink-0 bg-zinc-50 p-3 dark:bg-zinc-950/60">
                <div className="flex items-end gap-2 rounded-3xl bg-zinc-100 p-2 dark:bg-zinc-900">
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
                    placeholder={`Message ${otherUser.displayName || otherUser.username}`}
                    className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageText.trim() || sending}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                  >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="hidden flex-1 items-center justify-center px-6 md:flex">
              <div className="max-w-sm rounded-[32px] bg-zinc-50 p-10 text-center dark:bg-zinc-950">
                <MessageCircle size={44} className="mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Your conversations</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Pick a chat or search someone to start messaging.</p>
                <button onClick={() => setSearchOpen(true)} className="app-primary-button mt-5">
                  <UserPlus size={16} />
                  Start chat
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 px-4 pt-20 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl dark:bg-zinc-950">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="font-semibold text-zinc-900 dark:text-white">New chat</h2>
              <button onClick={() => setSearchOpen(false)} className="app-icon-button">
                <X size={18} />
              </button>
            </div>
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2.5 dark:bg-zinc-900">
                <Search size={17} className="text-zinc-400" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  autoFocus
                  placeholder="Search by name or username"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-500"
                />
              </div>
            </div>
            <div className="max-h-[55vh] overflow-y-auto">
              {searching ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-zinc-400" />
                </div>
              ) : people.length ? (
                people.map((person) => (
                  <button key={person.uid} onClick={() => startChat(person)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <Avatar user={person} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{person.displayName}</p>
                        {person.verified && <BadgeCheck size={14} className="text-sky-500" />}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">@{person.username}</p>
                      {person.bio && <p className="mt-0.5 truncate text-xs text-zinc-500">{person.bio}</p>}
                    </div>
                  </button>
                ))
              ) : (
                <div className="app-empty-state py-12">
                  <Search size={34} className="mb-3 text-zinc-300 dark:text-zinc-600" />
                  <p className="font-semibold text-zinc-900 dark:text-white">{userSearch ? "No people found" : "Find someone"}</p>
                  <p className="mt-1 text-sm">Search users to start a private chat.</p>
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
      src={user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=27272a&color=fff`}
      alt={name}
      className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
    />
  );
}
