import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDocs } from "firebase/firestore";
import {
  BadgeCheck,
  Flame,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Search as SearchIcon,
  Sparkles,
  User,
  X,
} from "lucide-react";

import HivezLoader from "@/components/common/HivezLoader";
import ExploreGrid from "@/components/search/ExploreGrid";
import { useAuth } from "@/context/AuthContext";
import { useLiveProfiles } from "@/hooks/useLiveProfile";
import type { FeedPost } from "@/components/feed/Feed";
import { recentPostsQuery } from "@/services/feedRanking";
import { filterVisiblePosts, searchUsers, type SearchableUser } from "@/services/privacy";

const TRENDING_TOPICS = ["Lost Pets", "Road Safety", "Water Leakage", "Street Lights", "Blood Requests"];

export default function SearchPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [queryText, setQueryText] = useState("");
  const [users, setUsers] = useState<SearchableUser[]>([]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"top" | "users" | "posts">("top");
  const [discoveryTab, setDiscoveryTab] = useState<"explore" | "topics">("explore");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  const searchRunRef = useRef(0);

  const liveProfileIds = useMemo(
    () =>
      [
        ...new Set([
          ...users.map((candidate) => candidate.uid),
          ...posts.map((post) => post.uid || "").filter(Boolean),
        ]),
      ].slice(0, 60),
    [users, posts]
  );
  const liveProfiles = useLiveProfiles(liveProfileIds);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const performSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim().toLowerCase();
      const runId = ++searchRunRef.current;
      if (!trimmed) {
        setUsers([]);
        setPosts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [matchedUsers, postsSnapshot] = await Promise.all([
          searchUsers(trimmed, user?.uid, 20),
          getDocs(recentPostsQuery()),
        ]);

        const candidates = postsSnapshot.docs.map((postDoc) => ({
          id: postDoc.id,
          ...(postDoc.data() as Omit<FeedPost, "id">),
        }));
        const visiblePosts = await filterVisiblePosts(user?.uid, candidates);
        const matchedPosts = visiblePosts.filter((post) => {
          const caption = (post.caption || "").toLowerCase();
          const hashtags = (post.hashtags || []).map((tag) => tag.toLowerCase());
          return caption.includes(trimmed) || hashtags.some((tag) => tag === trimmed || tag === `#${trimmed}`);
        });

        if (runId !== searchRunRef.current) return;
        setUsers(matchedUsers);
        setPosts(matchedPosts.slice(0, 30));
      } catch (err) {
        console.error("Search error:", err);
        if (runId === searchRunRef.current) {
          setUsers([]);
          setPosts([]);
        }
      } finally {
        if (runId === searchRunRef.current) setLoading(false);
      }
    },
    [user]
  );

  function handleQueryChange(value: string) {
    setQueryText(value);
    setActiveTab("top");
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => performSearch(value), 260);
  }

  function clearSearch() {
    searchRunRef.current += 1;
    setQueryText("");
    setUsers([]);
    setPosts([]);
    setActiveTab("top");
    setLoading(false);
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
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Search people, posts, and hives"
              className="w-full rounded-full border border-transparent bg-zinc-100 py-3 pl-12 pr-12 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-300 dark:bg-zinc-900 dark:text-white dark:focus:border-zinc-700"
            />
            {queryText && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 transition hover:bg-zinc-200 dark:hover:bg-zinc-800"
                aria-label="Clear search"
              >
                <X size={16} className="text-zinc-500" />
              </button>
            )}
          </div>
        </div>

        {queryText ? (
          <div className="flex">
            {(["top", "users", "posts"] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`app-tab capitalize ${activeTab === tab ? "app-tab-active" : ""}`}>
                {tab}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex px-4 pb-3">
            {(["explore", "topics"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setDiscoveryTab(tab)}
                className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-2 text-xs font-black uppercase tracking-wider transition ${
                  discoveryTab === tab
                    ? "border-[#3d654c] text-[#3d654c] dark:border-[#f2c14e] dark:text-[#f2c14e]"
                    : "border-transparent text-[#1c1d1a]/45 hover:text-[#1c1d1a] dark:text-neutral-500 dark:hover:text-white"
                }`}
              >
                {tab === "explore" ? <Sparkles size={14} /> : <Flame size={14} />}
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!queryText ? (
          discoveryTab === "explore" ? (
            <ExploreGrid />
          ) : (
            <div className="space-y-6 p-4">
              <section>
                <div className="mb-4 flex items-center gap-2">
                  <Flame size={18} className="text-[#3d654c] dark:text-[#f2c14e]" />
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Trending Hives</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TRENDING_TOPICS.map((topic) => (
                    <button key={topic} type="button" onClick={() => handleQueryChange(topic)} className="app-secondary-button">
                      <span>{topic}</span>
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
                  Search for local reports, people, and community topics. Explore uses real public Hivez posts.
                </p>
              </section>
            </div>
          )
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
                  {users.map((candidate) => {
                    const live = liveProfiles[candidate.uid];
                    const name = live?.displayName || candidate.displayName || candidate.username;
                    const username = live?.username || candidate.username;
                    const photo = live?.photoURL || candidate.photoURL;
                    const bio = live?.bio ?? candidate.bio;
                    const verified = live?.verified ?? candidate.verified;
                    return (
                      <button
                        key={candidate.uid}
                        type="button"
                        onClick={() => navigate(`/profile?uid=${candidate.uid}`)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      >
                        <img
                          src={photo || "https://ui-avatars.com/api/?name=Hivez&background=27272a&color=fff"}
                          alt={username}
                          className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{name}</span>
                            {verified && <BadgeCheck size={14} className="flex-shrink-0 text-sky-500" />}
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">@{username}</p>
                          {bio && <p className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400">{bio}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {(activeTab === "top" || activeTab === "posts") && posts.length > 0 && (
              <section className={activeTab === "top" && users.length > 0 ? "border-t border-zinc-200 dark:border-zinc-800" : ""}>
                {activeTab === "top" && <h3 className="app-section-label px-4 py-3">Posts</h3>}
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {posts.map((post) => {
                    const live = post.uid ? liveProfiles[post.uid] : undefined;
                    const authorName = live?.displayName || post.displayName || post.username;
                    const authorPhoto = live?.photoURL || post.photoURL;
                    const mediaItem = post.mediaItems?.[0];
                    const mediaUrl = mediaItem?.url || post.mediaUrls?.[0] || post.mediaUrl;
                    const isVideo = mediaItem?.type === "video" || post.mediaType === "video";

                    return (
                      <button
                        key={post.id}
                        type="button"
                        onClick={() => navigate(`/post/${post.id}`)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      >
                        {mediaUrl ? (
                          <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
                            {isVideo ? (
                              <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" disablePictureInPicture />
                            ) : (
                              <img src={mediaUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                            )}
                          </div>
                        ) : (
                          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900">
                            <ImageIcon size={20} className="text-zinc-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <img
                              src={authorPhoto || "https://ui-avatars.com/api/?name=Hivez&background=27272a&color=fff"}
                              alt=""
                              className="h-5 w-5 rounded-full object-cover"
                            />
                            <span className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{authorName}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-zinc-900 dark:text-white">{post.caption || "Community update"}</p>
                          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                            <span className="inline-flex items-center gap-1">
                              <Heart size={12} /> {post.likes || 0}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle size={12} /> {post.comments || 0}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
