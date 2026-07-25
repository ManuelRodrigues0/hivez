import { Search } from "lucide-react";

interface Props {
  value: string;

  onChange: (value: string) => void;

  placeholder?: string;
}

export default function SearchBar({
  value,
  onChange,
  placeholder = "Search users...",
}: Props) {
  return (
    <div className="relative">
      <Search
        size={18}
        className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
      />

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-zinc-900 py-3 pl-12 pr-4 text-white outline-none placeholder:text-zinc-500"
      />
    </div>
  );
}