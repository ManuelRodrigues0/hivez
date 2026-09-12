/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { BadgeCheck, Check, Search, Send, X } from "lucide-react";
import { toast } from "sonner";

import HivezLoader from "@/components/common/HivezLoader";
import type { FeedPost } from "@/components/feed/Feed";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/firebase/firebase";
import { useLiveProfiles } from "@/hooks/useLiveProfile";
import { sendPostViaDm } from "@/services/dmSharing";
import { searchUsers, type SearchableUser } from "@/services/privacy";
import { ULTRA_BEE_ID } from "@/constants/ultraBee";
import { timestampMillis, type TimestampLike } from "@/types/timestamp";

interface ChatDoc {
  id: string;
  participants: string[];
  participantProfiles?: Record<string, SearchableUser>;
  lastMessageAt?: TimestampLike | null;
}

interface Props {
  post: FeedPost;
  open: boolean;
  onClose: () => void;
}

function userSummary(user: SearchableUser): SearchableUser {
  return {
    uid: user.uid,
    username: user.username || "",
    displayName: user.displayName || user.username || "Hivez User",
    photoURL: user.photoURL || "",
    verified: Boolean(user.verified),
    bio: user.bio || "",
  };
}

export default function PostSendSheet({ post, open, onClose }: Props) {
  const { user, profile } = useAuth();
  const [chats, setChats] = useState<ChatDoc[]>([]);
  const [queryText, setQueryText] = useState("");
  const [people, setPeople] = useState<SearchableUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Record<string, SearchableUser>>({});
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    return onSnapshot(collection(db, "chats"), (snapshot) => {
      const nextChats = snapshot.docs
        .map((chatDoc) => ({ id: chatDoc.id, ...(chatDoc.data() as Omit<ChatDoc, "id">) }))
        .filter((chat) => chat.participants?.includes(user.uid))
        .sort((a, b) => timestampMillis(b.lastMessageAt) - timestampMillis(a.lastMessageAt))
        .slice(0, 10);
      setChats(nextChats);
    });
  }, [open, user]);

  const recentIds = useMemo(() => {
    if (!user) return [];
    return chats
      .map((chat) => chat.participants.find((id) => id !== user.uid && id !== ULTRA_BEE_ID))
      .filter(Boolean) as string[];
  }, [chats, user]);
  const liveProfiles = useLiveProfiles(recentIds);

  const recentPeople = useMemo(() => {
    if (!user) return [];
    return chats
      .map((chat) => {
        const id = chat.participants.find((participantId) => participantId !== user.uid && participantId !== ULTRA_BEE_ID);
        if (!id) return null;
        const stored = chat.participantProfiles?.[id];
        const live = liveProfiles[id];
        return live ? userSummary({ ...(stored || {}), ...live, uid: id } as SearchableUser) : stored ? userSummary({ ...stored, uid: id }) : null;
      })
      .filter(Boolean) as SearchableUser[];
  }, [chats, liveProfiles, user]);

  useEffect(() => {
    if (!open) return;
    const trimmed = queryText.trim();
    if (!trimmed) {
      setPeople([]);
      setSearching(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        setPeople(await searchUsers(trimmed, user?.uid, 12));
      } finally {
        setSearching(false);
      }
    }, 240);

    return () => window.clearTimeout(timeout);
  }, [open, queryText, user?.uid]);

  useEffect(() => {
    if (!open) {
      setQueryText("");
      setPeople([]);
      setSelected({});
      setMessage("");
      setSending(false);
    }
  }, [open]);

  function togglePerson(person: SearchableUser) {
    setSelected((current) => {
      const next = { ...current };
      if (next[person.uid]) {
        delete next[person.uid];
      } else {
        next[person.uid] = userSummary(person);
      }
      return next;
    });
  }

  async function sendSelected() {
    if (!user || sending) return;
    const recipients = Object.values(selected);
    if (!recipients.length) return;

    const actor = {
      uid: user.uid,
      username: profile?.username || user.email?.split("@")[0] || "",
      displayName: profile?.displayName || user.displayName || "Hivez User",
      photoURL: profile?.photoURL || user.photoURL || "",
    };

    setSending(true);
    try {
      let sent = 0;
      const failures: string[] = [];
      for (const recipient of recipients) {
        try {
          await sendPostViaDm({ post, sender: actor, recipient, optionalText: message });
          sent += 1;
        } catch (error) {
          failures.push(error instanceof Error ? error.message : `Could not send to ${recipient.displayName}`);
        }
      }

      if (sent) toast.success(sent === 1 ? "Post sent" : `Post sent to ${sent} people`);
      if (failures.length) toast.error(failures[0]);
      if (sent) onClose();
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const selectedCount = Object.keys(selected).length;
  const candidates = queryText.trim() ? people : recentPeople;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 px-0 backdrop-blur-xs sm:items-center sm:px-4" role="dialog" aria-modal="true" aria-label="Send post via direct message">
      <div className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-[#1c1d1a]/10 bg-white shadow-2xl dark:border-neutral-800 dark:bg-[#121212] sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-[#1c1d1a]/10 px-4 py-3.5 dark:border-neutral-800">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-[#1c1d1a] dark:text-white">Send Post</h2>
            <p className="text-[11px] font-medium text-[#1c1d1a]/55 dark:text-neutral-400">Share privately through Direct Messages</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f7f7f2] text-[#1c1d1a] transition hover:bg-[#ecece5] dark:bg-[#1a1a1a] dark:text-white"
            aria-label="Close send sheet"
          >
            <X size={16} />
          </button>
        </div>

        <div className="border-b border-[#1c1d1a]/5 p-3 dark:border-neutral-800/60">
          <div className="flex items-center gap-2 rounded-xl border border-[#1c1d1a]/10 bg-[#f7f7f2] px-3.5 py-2.5 dark:border-neutral-800 dark:bg-[#181818]">
            <Search size={15} className="text-[#3d654c] dark:text-[#f2c14e]" />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              autoFocus
              placeholder="Search people..."
              className="flex-1 bg-transparent text-xs font-medium text-[#1c1d1a] placeholder:text-[#1c1d1a]/40 outline-none dark:text-white dark:placeholder:text-neutral-500"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {searching ? (
            <div className="flex justify-center py-8">
              <HivezLoader size="sm" progress={62} label="Searching people" />
            </div>
          ) : candidates.length ? (
            candidates.map((person) => {
              const isSelected = Boolean(selected[person.uid]);
              return (
                <button
                  key={person.uid}
                  type="button"
                  onClick={() => togglePerson(person)}
                  className="flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition hover:bg-[#1c1d1a]/5 dark:hover:bg-white/5"
                >
                  <img
                    src={person.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.displayName || person.username || "Hivez")}&background=3d654c&color=fff`}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full border border-[#1c1d1a]/10 object-cover dark:border-neutral-700"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-bold text-[#1c1d1a] dark:text-white">{person.displayName}</p>
                      {person.verified && <BadgeCheck size={14} className="text-[#3d654c] dark:text-[#f2c14e]" />}
                    </div>
                    <p className="text-[10px] font-bold text-[#1c1d1a]/50 dark:text-neutral-400">@{person.username}</p>
                  </div>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${isSelected ? "border-[#3d654c] bg-[#3d654c] text-white dark:border-[#f2c14e] dark:bg-[#f2c14e] dark:text-[#121212]" : "border-[#1c1d1a]/20 dark:border-neutral-700"}`}>
                    {isSelected && <Check size={14} />}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="py-10 text-center">
              <p className="text-xs font-bold text-[#1c1d1a] dark:text-white">{queryText ? "No people found" : "No recent conversations"}</p>
              <p className="mt-1 text-[11px] text-[#1c1d1a]/55 dark:text-neutral-400">Search for someone to send this post.</p>
            </div>
          )}
        </div>

        <div className="border-t border-[#1c1d1a]/10 p-3 dark:border-neutral-800">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={2}
            placeholder="Add a message..."
            className="mb-2 max-h-28 w-full resize-none rounded-2xl border border-[#1c1d1a]/10 bg-[#f7f7f2] px-3 py-2 text-xs font-medium text-[#1c1d1a] outline-none placeholder:text-[#1c1d1a]/40 focus:border-[#3d654c]/40 dark:border-neutral-800 dark:bg-[#181818] dark:text-white dark:placeholder:text-neutral-500 dark:focus:border-[#f2c14e]/40"
          />
          <button
            type="button"
            onClick={sendSelected}
            disabled={!selectedCount || sending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#3d654c] px-4 py-3 text-xs font-black text-white shadow-2xs transition hover:bg-[#32533e] disabled:opacity-45 dark:bg-[#f2c14e] dark:text-[#121212] dark:hover:bg-[#dfb041]"
          >
            {sending ? <HivezLoader size="sm" progress={74} label="Sending" /> : <Send size={15} />}
            <span>{selectedCount ? `Send to ${selectedCount}` : "Select people"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
