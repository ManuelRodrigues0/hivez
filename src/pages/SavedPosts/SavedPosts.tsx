/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, ShieldX } from "lucide-react";

import FeedCard from "@/components/feed/FeedCard";
import HivezLoader from "@/components/common/HivezLoader";
import { useAuth } from "@/context/AuthContext";
import { listenToUserSavedPosts } from "@/services/savedPosts";
import { listenToPostsByIds } from "@/services/rehives";
import type { FeedPost } from "@/components/feed/Feed";

export default function SavedPosts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [postIds, setPostIds] = useState<string[] | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [someUnavailable, setSomeUnavailable] = useState(false);

  // Saved posts are private to the signed-in owner; the savedPosts rules only
  // ever expose documents where userId == auth.uid.
  useEffect(() => {
    if (!user) return;
    return listenToUserSavedPosts(
      user.uid,
      (records) => setPostIds(records.map((record) => record.postId).filter(Boolean)),
      () => setPostIds([])
    );
  }, [user?.uid]);

  const idsKey = postIds ? postIds.join(",") : "";

  useEffect(() => {
    if (!postIds) return;
    if (!postIds.length) {
      setPosts([]);
      setSomeUnavailable(false);
      return;
    }
    // Resolves the underlying posts live; deleted/unavailable posts are
    // dropped gracefully instead of breaking the whole list.
    return listenToPostsByIds(
      postIds,
      (next) => {
        setPosts(next);
        setSomeUnavailable(next.length < postIds.length);
      },
      () => setSomeUnavailable(true)
    );
  }, [idsKey]);

  if (postIds === null) {
    return <HivezLoader fullScreen size="lg" progress={58} label="Loading saved posts" />;
  }

  return (
    <div className="min-h-screen w-full bg-[#f4f4ef] dark:bg-black">
      <div className="mx-auto w-full max-w-2xl px-4 py-5">
        <div className="flex items-center gap-3 pb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#1c1d1a]/10 bg-white text-[#1c1d1a] shadow-2xs transition hover:bg-[#ecece5] dark:border-neutral-800 dark:bg-[#141414] dark:text-white dark:hover:bg-neutral-800"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-[#1c1d1a] dark:text-white">Saved Posts</h1>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#3d654c] dark:text-[#f2c14e]">
              Private to you{posts.length ? ` · ${posts.length}` : ""}
            </p>
          </div>
        </div>

        {postIds.length === 0 ? (
          <div className="rounded-2xl border border-[#1c1d1a]/10 bg-white p-10 text-center shadow-xs dark:border-neutral-800/90 dark:bg-[#121212]">
            <Bookmark size={32} className="mx-auto mb-3 text-[#3d654c]/50 dark:text-[#f2c14e]/50" />
            <h2 className="text-sm font-black text-[#1c1d1a] dark:text-white">Nothing saved yet</h2>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#1c1d1a]/55 dark:text-neutral-400">
              Tap the bookmark icon on any post to keep it here. Saved posts are visible only to you.
            </p>
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-[#1c1d1a]/10 bg-white p-10 text-center shadow-xs dark:border-neutral-800/90 dark:bg-[#121212]">
            <ShieldX size={32} className="mx-auto mb-3 text-zinc-400" />
            <h2 className="text-sm font-black text-[#1c1d1a] dark:text-white">Saved posts unavailable</h2>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#1c1d1a]/55 dark:text-neutral-400">
              The posts you saved are no longer available.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <FeedCard key={post.id} post={post} />
            ))}
          </div>
        )}

        {someUnavailable && posts.length > 0 && (
          <p className="mt-4 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
            Some saved posts are no longer available.
          </p>
        )}
      </div>
    </div>
  );
}
