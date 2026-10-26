import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/firebase";
import { useAuth } from "@/context/AuthContext";
import FeedCard from "@/components/feed/FeedCard";
import type { FeedPost } from "@/components/feed/Feed";
import HivezLoader from "@/components/common/HivezLoader";

export default function PostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<{ id?: string; post: FeedPost | null; error?: string }>({ post: null });
  useEffect(() => {
    if (!id || !user) return;
    return onSnapshot(doc(db, "posts", id), (snap) => {
      setResult({
        id, post: snap.exists() ? { ...snap.data(), id: snap.id } as FeedPost : null,
        error: snap.exists() ? undefined : "This post may have been deleted."
      });
    }, () => {
      setResult({ id, post: null, error: "This post is unavailable. It may be private, or your connection may be offline." });
    });
  }, [id, user]);
  if (authLoading || (user && id && result.id !== id)) {
    return <HivezLoader fullScreen size="lg" progress={64} label="Loading post" />;
  }
  return (
    <div className="app-page hv-post-detail">
      <header className="app-sticky-header flex items-center gap-3 px-4 py-3">
        <button type="button" aria-label="Back to previous page" className="app-icon-button"
          onClick={() => window.history.length > 1 ? navigate(-1) : navigate("/")}><ArrowLeft size={20} /></button>
        <h1 className="text-base font-semibold">Post</h1>
      </header>
      {result.post ? <FeedCard key={result.post.id} post={result.post} /> : (
        <section className="mx-auto flex min-h-80 max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-xl font-semibold">Post unavailable</h2>
          <p>{result.error || "Sign in to view this post."}</p>
          <button type="button" className="hv-button" onClick={() => navigate(user ? "/" : "/login")}>{user ? "Back to your feed" : "Sign in"}</button>
        </section>
      )}
    </div>
  );
}
