import UserCard from "./UserCard";

interface SearchUser {
  uid: string;

  username: string;

  displayName: string;

  photoURL: string;

  verified: boolean;

  bio?: string;
}

interface Props {
  results: SearchUser[];

  loading: boolean;

  query: string;
}

export default function SearchResults({
  results,
  loading,
  query,
}: Props) {
  if (loading) {
    return (
      <div className="py-10 text-center text-zinc-500 dark:text-zinc-400">
        Searching...
      </div>
    );
  }

  if (!query.trim()) {
    return (
      <div className="py-10 text-center text-zinc-500 dark:text-zinc-400">
        Try searching for someone.
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-10 text-center text-zinc-500 dark:text-zinc-400">
        No users found for "{query}".
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {results.map((user) => (
        <UserCard key={user.uid} user={user} />
      ))}
    </div>
  );
}