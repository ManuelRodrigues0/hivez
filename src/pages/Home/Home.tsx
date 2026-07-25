import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import Feed from "@/components/feed/Feed";
import Composer from "@/components/feed/Composer";

export default function Home() {
  const navigate = useNavigate();

  function handlePost(text: string) {
    navigate("/camera", { state: { text } });
  }

  return (
    <div className="flex flex-col">
      {/* "For you" header */}
      <div className="sticky top-0 z-10 border-b border-zinc-800 bg-black/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-bold text-white">For you</h1>
      </div>

      {/* Composer at top */}
      <Composer onPost={handlePost} />

      {/* Feed */}
      <Feed />

      {/* Floating + button */}
      <button
        onClick={() => navigate("/camera")}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:bg-zinc-200 dark:bg-white dark:text-black lg:bottom-8 lg:right-8"
      >
        <Plus size={24} />
      </button>
    </div>
  );
}