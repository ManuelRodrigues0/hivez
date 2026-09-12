import { useMemo, type ReactNode } from "react";

import CommentCard from "./CommentCard";
import HivezLoader from "../common/HivezLoader";
import type { CommentDoc } from "@/services/comments";

interface Props {
  comments: CommentDoc[];

  loading: boolean;

  postId: string;

  /** Called when the user presses Reply on a comment. */
  onReply?: (comment: CommentDoc) => void;
}

/**
 * Renders comments as a real thread: top-level comments followed by their
 * replies (nested by depth). The flat Firestore listener (createdAt asc) feeds
 * a children map so any new reply appears under its correct parent in realtime.
 */
export default function CommentList({
  comments,
  loading,
  postId,
  onReply,
}: Props) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string, CommentDoc[]>();
    for (const comment of comments) {
      const parentKey = comment.parentId || "__root__";
      const list = map.get(parentKey) || [];
      list.push(comment);
      map.set(parentKey, list);
    }
    return map;
  }, [comments]);

  const rootComments = childrenByParent.get("__root__") || [];

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

  function renderNode(comment: CommentDoc, depth: number): ReactNode {
    const replies = childrenByParent.get(comment.id) || [];
    return (
      <div key={comment.id}>
        <CommentCard comment={comment} postId={postId} depth={depth} onReply={onReply} />
        {replies.map((reply) => renderNode(reply, depth + 1))}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5">
      {rootComments.map((comment) => renderNode(comment, 0))}
      <div className="h-24" />
    </div>
  );
}