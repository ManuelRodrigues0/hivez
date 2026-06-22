import CommentCard from "./CommentCard";

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
  comments: Comment[];

  loading: boolean;
}

export default function CommentList({
  comments,
  loading,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-zinc-500">
        Loading replies...
      </div>
    );
  }

  if (!comments.length) {
    return (
      <div className="flex flex-1 items-center justify-center text-center text-zinc-500">
        <div>

          <p className="text-lg font-semibold">
            No replies yet
          </p>

          <p className="mt-2 text-sm">
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
        />
      ))}

      <div className="h-24" />

    </div>
  );
}