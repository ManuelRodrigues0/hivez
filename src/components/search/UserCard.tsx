import { BadgeCheck } from "lucide-react";

interface SearchUser {
  uid: string;

  username: string;

  displayName: string;

  photoURL: string;

  verified: boolean;

  bio?: string;
}

interface Props {
  user: SearchUser;
}

export default function UserCard({ user }: Props) {
  return (
    <button className="flex w-full items-center gap-3 px-5 py-4 transition hover:bg-zinc-900">
      <img
        src={
          user.photoURL ||
          "https://ui-avatars.com/api/?name=Hivez"
        }
        alt={user.username}
        className="h-12 w-12 rounded-full object-cover"
      />

      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">
            {user.displayName}
          </span>

          {user.verified && (
            <BadgeCheck size={15} className="text-sky-500" />
          )}
        </div>

        <span className="text-sm text-zinc-500">
          @{user.username}
        </span>

        {user.bio && (
          <p className="mt-1 text-sm text-zinc-400 line-clamp-1">
            {user.bio}
          </p>
        )}
      </div>
    </button>
  );
}