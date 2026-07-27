import { MessageCircle } from "lucide-react";

export default function Chats() {
  return (
    <div className="app-page">
      <div className="app-empty-state">
        <MessageCircle size={40} className="mb-4 text-zinc-300 dark:text-zinc-600" />
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Chats</h1>
        <p className="mt-1 text-sm">Messages and conversations will appear here.</p>
      </div>
    </div>
  );
}
