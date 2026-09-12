import CommentCard from "./CommentCard";
import HivezLoader from "../common/HivezLoader";
import type { CommentDoc } from "@/services/comments";

interface Props {
  comments: CommentDoc[];

  loading: boolean;

  postId: string;
}

export default function CommentList({
  comments,
  loading,
  postId,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <HivezLoader size="sm" progress={54} label="Loading replies" />
      </div>
    );
  }

  if (!comments.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-center text-zinc-500 dark:text-zinc-400">
        <div>

          <p className="text-lg font-semibold text-zinc-900 dark:text-white">
            No replies yet
          </p>

          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Be the first to reply.
          </p>

        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5">

      {comments.map((comment) => (
        <CommentCard
          key={comment.id}
          comment={comment}
          postId={postId}
        />
      ))}

      <div className="h-24" />

    </div>
  );
}
