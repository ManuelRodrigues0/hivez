import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { BadgeCheck, Heart, MessageCircle, Search as SearchIcon, TrendingUp, User, X } from "lucide-react";
import HivezLoader from "@/components/common/HivezLoader";
import { db } from "../../firebase/firebase";
import type { PostMediaItem } from "@/components/feed/MediaGrid";

interface SearchUser {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  verified: boolean;
  bio?: string;
}

interface SearchPost {
  id: string;
  caption: string;
  mediaUrl: string;
  mediaUrls?: string[];
  mediaItems?: PostMediaItem[];
  mediaType: "image" | "video";
  username: string;
  displayName: string;
  photoURL: string;
  likes: number;
  comments: number;
  createdAt: any;
}

const TRENDING_TOPICS = [
  { tag: "Lost Pets", icon: "🐶" },
  { tag: "Road Safety", icon: "🛣️" },
  { tag: "Water Leakage", icon: "🚰" },
  { tag: "Street Lights", icon: "💡" },
  { tag: "Blood Requests", icon: "🩸" },
];

export default function SearchPage() {
  const navigate = useNavigate();
  const [queryText, setQueryText] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"top" | "users" | "posts">("top");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const performSearch = useCallback(async (q: string) => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) {
      setUsers([]);
      setPosts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const matchedUsers: SearchUser[] = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        const username = (data.username || "").toLowerCase();
        const displayName = (data.displayName || "").toLowerCase();
        if (username.includes(trimmed) || displayName.includes(trimmed)) {
          matchedUsers.push({
            uid: doc.id,
            username: data.username || "",
            displayName: data.displayName || "",
            photoURL: data.photoURL || "",
            verified: data.verified || false,
            bio: data.bio || "",
          });
        }
      });

      const postsSnapshot = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)));
      const matchedPosts: SearchPost[] = [];
      postsSnapshot.forEach((doc) => {
        const data = doc.data();
        const caption = (data.caption || "").toLowerCase();
        const hashtags = (data.hashtags || []).map((t: string) => t.toLowerCase());
        if (caption.includes(trimmed) || hashtags.some((t: string) => t === trimmed || t === `#${trimmed}`)) {
          matchedPosts.push({
            id: doc.id,
            caption: data.caption || "",
            mediaUrl: data.mediaUrl || "",
            mediaUrls: data.mediaUrls || [],
            mediaItems: data.mediaItems || [],
            mediaType: data.mediaType || "image",
            username: data.username || "",
            displayName: data.displayName || "",
            photoURL: data.photoURL || "",
            likes: data.likes || 0,
            comments: data.comments || 0,
            createdAt: data.createdAt || null,
          });
        }
      });

      setUsers(matchedUsers);
      setPosts(matchedPosts);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQueryText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => performSearch(value), 300);
  }

  function clearSearch() {
    setQueryText("");
    setUsers([]);
    setPosts([]);
    setActiveTab("top");
    inputRef.current?.focus();
  }

  const hasResults = users.length > 0 || posts.length > 0;

  return (
    <div className="app-page app-search-page flex flex-col">
      <div className="app-sticky-header">
        <div className="px-4 pb-3 pt-4">
          <div className="relative">
            <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              ref={inputRef}
              type="text"
              value={queryText}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search people, posts, and hives"
              className="w-full rounded-full border border-transparent bg-zinc-100 py-3 pl-12 pr-12 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-300 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-700"
            />
            {queryText && (
              <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 transition hover:bg-zinc-200 dark:hover:bg-zinc-800">
                <X size={16} className="text-zinc-500" />
              </button>
            )}
          </div>
        </div>

        {queryText && (
          <div className="flex">
            {(["top", "users", "posts"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`app-tab capitalize ${activeTab === tab ? "app-tab-active" : ""}`}>
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!queryText ? (
          <div className="space-y-6 p-4">
            <section>
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-zinc-400" />
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Trending Hives</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {TRENDING_TOPICS.map((topic) => (
                  <button key={topic.tag} onClick={() => handleQueryChange(topic.tag)} className="app-secondary-button">
                    <span>{topic.icon}</span>
                    <span>{topic.tag}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="app-surface p-4">
              <div className="mb-2 flex items-center gap-2">
                <User size={18} className="text-zinc-400" />
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Suggested</h2>
              </div>
              <p className="text-sm leading-5 text-zinc-500 dark:text-zinc-400">
                Start typing to find local reports, people, and community topics.
              </p>
            </section>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <HivezLoader size="sm" progress={62} label="Searching" />
          </div>
        ) : !hasResults ? (
          <div className="app-empty-state">
            <SearchIcon size={40} className="mb-4 text-zinc-300 dark:text-zinc-600" />
            <p className="text-lg font-semibold">No results found</p>
            <p className="mt-1 text-sm">Try another name, topic, or keyword.</p>
          </div>
        ) : (
          <div>
            {(activeTab === "top" || activeTab === "users") && users.length > 0 && (
              <section>
                {activeTab === "top" && <h3 className="app-section-label px-4 py-3">People</h3>}
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {users.map((user) => (
                    <button key={user.uid} onClick={() => navigate(`/profile?uid=${user.uid}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <img src={user.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=27272a&color=fff"} alt={user.username} className="h-11 w-11 flex-shrink-0 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{user.displayName || user.username}</span>
                          {user.verified && <BadgeCheck size={14} className="flex-shrink-0 text-sky-500" />}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">@{user.username}</p>
                        {user.bio && <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">{user.bio}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {(activeTab === "top" || activeTab === "posts") && posts.length > 0 && (
              <section className={activeTab === "top" && users.length > 0 ? "border-t border-zinc-200 dark:border-zinc-800" : ""}>
                {activeTab === "top" && <h3 className="app-section-label px-4 py-3">Posts</h3>}
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {posts.map((post) => (
                    <button key={post.id} onClick={() => navigate(`/post/${post.id}`)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      {(post.mediaItems?.[0]?.url || post.mediaUrls?.[0] || post.mediaUrl) && (
                        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
                          {(post.mediaItems?.[0]?.type || post.mediaType) === "video" ? (
                            <video src={post.mediaItems?.[0]?.url || post.mediaUrls?.[0] || post.mediaUrl} className="h-full w-full object-cover" />
                          ) : (
                            <img src={post.mediaItems?.[0]?.url || post.mediaUrls?.[0] || post.mediaUrl} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <img src={post.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=27272a&color=fff"} alt="" className="h-5 w-5 rounded-full object-cover" />
                          <span className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{post.displayName || post.username}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-zinc-900 dark:text-white">{post.caption}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                          <span className="inline-flex items-center gap-1"><Heart size={12} /> {post.likes}</span>
                          <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {post.comments}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
