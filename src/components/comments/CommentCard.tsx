import { Heart } from "lucide-react";

interface Comment {
  id: string;

  uid: string;

  username: string;

  displayName: string;

  photoURL: string;

  text: string;

  createdAt: any;
}

interface Props {
  comment: Comment;
}

function timeAgo(timestamp: any) {
  if (!timestamp?.toDate) return "Now";

  const seconds = Math.floor(
    (Date.now() - timestamp.toDate().getTime()) / 1000
  );

  if (seconds < 60) return "Now";

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);

  return `${days}d`;
}

export default function CommentCard({
  comment,
}: Props) {
  return (
    <article className="flex gap-3 py-4">

      <img
        src={
          comment.photoURL ||
          "https://ui-avatars.com/api/?name=Hivez"
        }
        alt={comment.username}
        className="h-10 w-10 rounded-full object-cover"
      />

      <div className="min-w-0 flex-1">

        <div className="flex items-center gap-2">

          <span className="font-semibold text-white">
            {comment.displayName}
          </span>

          <span className="text-sm text-zinc-500">
            @{comment.username}
          </span>

          <span className="text-sm text-zinc-500">
            · {timeAgo(comment.createdAt)}
          </span>

        </div>

        <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-6 text-white">
          {comment.text}
        </p>

      </div>

      <button className="mt-1 rounded-full p-2 transition hover:bg-zinc-900 active:scale-90">
        <Heart
          size={18}
          className="text-zinc-500"
        />
      </button>

    </article>
  );
}