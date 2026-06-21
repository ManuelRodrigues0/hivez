import { useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";

export default function Create() {
  const { state } = useLocation();

  const navigate = useNavigate();

  const [caption, setCaption] = useState("");

  const file: File | undefined = state?.media;

  const preview = useMemo(() => {
    if (!file) return "";

    return URL.createObjectURL(file);
  }, [file]);

  if (!file) {
    navigate("/");
    return null;
  }

  const isVideo = file.type.startsWith("video");

  return (
    <main className="min-h-screen bg-black text-white">

      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">

        <button
          onClick={() => navigate("/")}
          className="text-zinc-400"
        >
          Cancel
        </button>

        <h1 className="text-lg font-semibold">
          New Thread
        </h1>

        <button
          className="font-semibold text-blue-500"
        >
          Post
        </button>

      </div>

      <div className="p-5">

        {isVideo ? (
          <video
            src={preview}
            controls
            className="mb-5 w-full rounded-2xl"
          />
        ) : (
          <img
            src={preview}
            className="mb-5 w-full rounded-2xl"
          />
        )}

        <textarea
          placeholder="Start a thread..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          className="h-36 w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-900 p-4 outline-none"
        />

      </div>

    </main>
  );
}