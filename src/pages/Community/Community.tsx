import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";

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
      <div className="app-empty-state">
        <div className="app-surface max-w-sm p-8">
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">Hive Not Found</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">This community is not available yet.</p>
          <button
            onClick={() => navigate("/")}
            className="app-primary-button mt-6"
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-sticky-header">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => navigate(-1)} className="app-icon-button">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-zinc-900 dark:text-white">
              {community.name}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Community feed</p>
          </div>
        </div>
      </div>

      <section className="border-b border-zinc-200 px-4 py-5 dark:border-zinc-800">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-4xl dark:bg-zinc-900">
            {community.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white">{community.name}</h2>
            <p className="mt-1 text-sm leading-5 text-zinc-500 dark:text-zinc-400">{community.description}</p>
            <div className="mt-3 flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              <Users size={14} />
              Local reports and updates
            </div>
          </div>
        </div>
      </section>

      <Feed category={community.id} />
    </div>
  );
}
