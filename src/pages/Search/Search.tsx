import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase/firebase";
import { Search as SearchIcon, X, Loader2, User, TrendingUp } from "lucide-react";

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
  const [query_text, setQueryText] = useState("");
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
      const allUsers: SearchUser[] = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        const username = (data.username || "").toLowerCase();
        const displayName = (data.displayName || "").toLowerCase();
        if (username.includes(trimmed) || displayName.includes(trimmed)) {
          allUsers.push({
            uid: doc.id,
            username: data.username || "",
            displayName: data.displayName || "",
            photoURL: data.photoURL || "",
            verified: data.verified || false,
            bio: data.bio || "",
          });
        }
      });

      const postsSnapshot = await getDocs(
        query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50))
      );
      const allPosts: SearchPost[] = [];
      postsSnapshot.forEach((doc) => {
        const data = doc.data();
        const caption = (data.caption || "").toLowerCase();
        const hashtags = (data.hashtags || []).map((t: string) => t.toLowerCase());
        const matchesCaption = caption.includes(trimmed);
        const matchesHashtag = hashtags.some((t: string) => t === trimmed || t === `#${trimmed}`);
        if (matchesCaption || matchesHashtag) {
          allPosts.push({
            id: doc.id,
            caption: data.caption || "",
            mediaUrl: data.mediaUrl || "",
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

      setUsers(allUsers);
      setPosts(allPosts);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = (value: string) => {
    setQueryText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => performSearch(value), 300);
  };

  const clearSearch = () => {
    setQueryText("");
    setUsers([]);
    setPosts([]);
    setActiveTab("top");
    inputRef.current?.focus();
  };

  const hasResults = users.length > 0 || posts.length > 0;

  return (
    <div className="flex min-h-full flex-col">
      {/* Search Header */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur-xl dark:border-zinc-800 dark:bg-black/95">
        <div className="px-4 pb-3 pt-4">
          <div className="relative">
            <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
            <input
              ref={inputRef}
              type="text"
              value={query_text}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search users and posts..."
              className="w-full rounded-xl bg-zinc-100 py-3 pl-12 pr-12 text-sm outline-none placeholder:text-zinc-400 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-400"
            />
            {query_text && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 transition hover:bg-zinc-200 dark:hover:bg-zinc-800"
              >
                <X size={16} className="text-zinc-500 dark:text-zinc-400" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {query_text && (
          <div className="flex border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => setActiveTab("top")}
              className={`flex-1 py-3 text-center text-sm font-medium transition ${
                activeTab === "top"
                  ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                  : "text-zinc-500"
              }`}
            >
              Top
            </button>
            <button
              onClick={() => setActiveTab("users")}
              className={`flex-1 py-3 text-center text-sm font-medium transition ${
                activeTab === "users"
                  ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                  : "text-zinc-500"
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex-1 py-3 text-center text-sm font-medium transition ${
                activeTab === "posts"
                  ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                  : "text-zinc-500"
              }`}
            >
              Posts
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {!query_text ? (
          <div className="p-4">
            <div className="mb-6">
              <div className="mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-zinc-400 dark:text-zinc-500" />
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Trending Hives</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {TRENDING_TOPICS.map((topic) => (
                  <button
                    key={topic.tag}
                    onClick={() => setQueryText(topic.tag)}
                    className="flex items-center gap-1.5 rounded-full border border-zinc-300 px-4 py-2 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    <span>{topic.icon}</span>
                    <span>{topic.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2">
                <User size={18} className="text-zinc-400 dark:text-zinc-500" />
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Suggested</h2>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Start typing to search for users and posts.
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-zinc-400 dark:text-zinc-500" />
          </div>
        ) : !hasResults ? (
          <div className="py-20 text-center">
            <SearchIcon size={40} className="mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
            <p className="text-lg font-semibold text-zinc-500 dark:text-zinc-400">No results found</p>
            <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
              Try searching for something else.
            </p>
          </div>
        ) : (
          <div>
            {(activeTab === "top" || activeTab === "users") && users.length > 0 && (
              <div>
                {activeTab === "top" && (
                  <h3 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Users
                  </h3>
                )}
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {users.map((user) => (
                    <button
                      key={user.uid}
                      onClick={() => navigate(`/profile?uid=${user.uid}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      <img
                        src={
                          user.photoURL ||
                          "https://ui-avatars.com/api/?name=Hivez&background=27272a&color=fff"
                        }
                        alt={user.username}
                        className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                            {user.displayName || user.username}
                          </span>
                          {user.verified && (
                            <span className="flex-shrink-0 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-500">
                              ✓
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          @{user.username}
                        </span>
                        {user.bio && (
                          <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">
                            {user.bio}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(activeTab === "top" || activeTab === "posts") && posts.length > 0 && (
              <div>
                {activeTab === "top" && users.length > 0 && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800" />
                )}
                {activeTab === "top" && (
                  <h3 className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Posts
                  </h3>
                )}
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {posts.map((post) => (
                    <button
                      key={post.id}
                      onClick={() => navigate(`/post/${post.id}`)}
                      className="flex w-full items-center gap-3 px-4 py-3 transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      {post.mediaUrl && (
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg">
                          {post.mediaType === "video" ? (
                            <video
                              src={post.mediaUrl}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <img
                              src={post.mediaUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <img
                            src={
                              post.photoURL ||
                              "https://ui-avatars.com/api/?name=Hivez&background=27272a&color=fff"
                            }
                            alt=""
                            className="h-5 w-5 rounded-full object-cover"
                          />
                          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {post.displayName || post.username}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-zinc-900 dark:text-white">
                          {post.caption}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>❤️ {post.likes}</span>
                          <span>💬 {post.comments}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}