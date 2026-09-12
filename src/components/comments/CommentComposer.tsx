import {
  forwardRef,
} from "react";

import { BadgeCheck, Send } from "lucide-react";
import type { SearchableUser } from "@/services/privacy";

interface Props {
  value: string;

  sending: boolean;

  onChange: (
    value: string
  ) => void;

  onSend: () => void;

  mentionSuggestions?: SearchableUser[];

  onSelectMention?: (user: SearchableUser) => void;
}

const CommentComposer = forwardRef<
  HTMLTextAreaElement,
  Props
>(
  (
    {
      value,
      sending,
      onChange,
      onSend,
      mentionSuggestions = [],
      onSelectMention,
    },
    ref
  ) => {
    return (
      <div className="sticky bottom-0 border-t border-zinc-800 dark:border-zinc-800 border-zinc-200 bg-white dark:bg-black/95 backdrop-blur-xl">
        {mentionSuggestions.length > 0 && (
          <div className="mx-4 mt-3 max-h-48 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            {mentionSuggestions.map((person) => (
              <button
                key={person.uid}
                type="button"
                onClick={() => onSelectMention?.(person)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <img
                  src={person.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.displayName || person.username || "Hivez")}&background=3d654c&color=fff`}
                  alt=""
                  className="h-8 w-8 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="truncate text-xs font-bold text-zinc-900 dark:text-white">{person.displayName}</span>
                    {person.verified && <BadgeCheck size={12} className="shrink-0 text-sky-500" />}
                  </div>
                  <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">@{person.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 p-4">

          <textarea
            ref={ref}
            value={value}
            rows={1}
            placeholder="Write a reply..."
            onChange={(e) =>
              onChange(e.target.value)
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey
              ) {
                e.preventDefault();

                onSend();
              }
            }}
            className="max-h-40 min-h-[48px] flex-1 resize-none rounded-2xl bg-zinc-100 dark:bg-zinc-900 px-4 py-3 text-zinc-900 dark:text-white outline-none placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
          />

          <button
            onClick={onSend}
            disabled={
              sending ||
              !value.trim()
            }
            className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500 transition active:scale-95 disabled:opacity-40"
          >
            <Send
              size={20}
              className="text-white"
            />
          </button>

        </div>

      </div>
    );
  }
);

CommentComposer.displayName =
  "CommentComposer";

export default CommentComposer;
