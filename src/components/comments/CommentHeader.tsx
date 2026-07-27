import { X } from "lucide-react";

interface Props {
  count: number;
  onClose: () => void;
}

export default function CommentHeader({
  count,
  onClose,
}: Props) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800 dark:border-zinc-800 border-zinc-200 bg-white dark:bg-black/95 backdrop-blur-xl">

      <div className="flex justify-center pt-3">
        <div className="h-1.5 w-12 rounded-full bg-zinc-300 dark:bg-zinc-600" />
      </div>

      <div className="flex items-center justify-between px-5 py-4">

        <div className="w-8" />

        <div className="text-center">

          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Replies
          </h2>

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {count} replies
          </p>

        </div>

        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95"
        >
          <X
            size={20}
            className="text-zinc-900 dark:text-white"
          />
        </button>

      </div>

    </header>
  );
}