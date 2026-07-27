import { Camera, Type } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateModal({ open, onClose }: Props) {
  const navigate = useNavigate();

  if (!open) return null;

  function handleCamera() {
    onClose();
    navigate("/camera");
  }

  function handleText() {
    onClose();
    navigate("/create", { state: { textMode: true, text: "" } });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="mx-4 w-full max-w-sm rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-center text-lg font-semibold text-zinc-900 dark:text-white">Create Post</h2>
        
        <div className="space-y-3">
          <button
            onClick={handleCamera}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500">
              <Camera size={24} className="text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-zinc-900 dark:text-white">Camera</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Take a photo or video</p>
            </div>
          </button>

          <button
            onClick={handleText}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 p-4 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500">
              <Type size={24} className="text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-zinc-900 dark:text-white">Text</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Write a text post</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
