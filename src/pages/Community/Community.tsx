import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import Feed from "@/components/feed/Feed";
import { COMMUNITIES } from "@/constants/communities";

export default function Community() {
  const { id } = useParams();
  const navigate = useNavigate();

  const community = useMemo(
    () => COMMUNITIES.find((c) => c.id === id),
    [id]
  );

  if (!community) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <h2 className="text-2xl font-bold">Hive Not Found</h2>

          <button
            onClick={() => navigate("/")}
            className="mt-6 rounded-lg bg-yellow-400 px-5 py-2 font-semibold text-black"
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="border-b border-zinc-800 px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="flex items-center gap-4">
          <div className="text-5xl">{community.icon}</div>

          <div>
            <h1 className="text-2xl font-bold">
              {community.name}
            </h1>

            <p className="text-sm text-zinc-400">
              Community Feed
            </p>
          </div>
        </div>
      </div>

      {/* We'll filter by category in the next file */}
      <Feed category={community.id} />
    </div>
  );
}