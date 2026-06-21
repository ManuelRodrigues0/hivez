import { useNavigate } from "react-router-dom";

import ProfileHeader from "../../components/profile/ProfileHeader";
import ProfileStats from "../../components/profile/ProfileStats";

export default function Profile() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-black text-white">

      <ProfileHeader />

      <ProfileStats />

      <div className="px-5 mt-6 flex gap-3">

        <button
          onClick={() => navigate("/profile/edit")}
          className="flex-1 rounded-xl border border-zinc-700 py-3 font-medium transition hover:bg-zinc-900"
        >
          Edit Profile
        </button>

        <button
          className="flex-1 rounded-xl border border-zinc-700 py-3 font-medium transition hover:bg-zinc-900"
        >
          Share Profile
        </button>

      </div>

      <div className="mt-8 border-b border-zinc-800">

        <div className="grid grid-cols-3">

          <button className="border-b-2 border-white py-4 font-semibold">
            Threads
          </button>

          <button className="py-4 text-zinc-500">
            Replies
          </button>

          <button className="py-4 text-zinc-500">
            Media
          </button>

        </div>

      </div>

      <div className="flex flex-col items-center justify-center py-24 text-center">

        <h2 className="text-xl font-semibold">
          No posts yet
        </h2>

        <p className="mt-2 text-zinc-500">
          Your posts will appear here.
        </p>

      </div>

    </main>
  );
}