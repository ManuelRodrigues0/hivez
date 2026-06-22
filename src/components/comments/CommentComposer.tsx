import {
  forwardRef,
} from "react";

import { Send } from "lucide-react";

interface Props {
  value: string;

  sending: boolean;

  onChange: (
    value: string
  ) => void;

  onSend: () => void;
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
    },
    ref
  ) => {
    return (
      <div className="sticky bottom-0 border-t border-zinc-800 bg-black/95 backdrop-blur-xl">

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
            className="max-h-40 min-h-[48px] flex-1 resize-none rounded-2xl bg-zinc-900 px-4 py-3 text-white outline-none placeholder:text-zinc-500"
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