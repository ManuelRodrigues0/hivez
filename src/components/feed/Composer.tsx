import { useState } from "react";
import { Image, Smile } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

interface Props {
  onPost: (text: string) => void;
}

export default function Composer({ onPost }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");

  function handleSubmit() {
    if (!text.trim()) return;
    onPost(text.trim());
    setText("");
  }

  return (
    <div className="border-b border-zinc-800 dark:border-zinc-800 border-zinc-200 p-4">
      <div className="flex gap-3">
        <img
          src={user?.photoURL || "https://ui-avatars.com/api/?name=Hivez&background=6366f1&color=fff"}
          alt=""
          className="h-10 w-10 rounded-full object-cover"
        />
        <div className="flex-1">
          <textarea
            placeholder="What's new?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="w-full resize-none bg-transparent text-sm text-zinc-900 dark:text-white outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-2">
              <button className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Image size={18} className="text-sky-500" />
              </button>
              <button className="rounded-full p-2 transition hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Smile size={18} className="text-sky-500" />
              </button>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="rounded-full bg-white dark:bg-white px-5 py-1.5 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-50"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}