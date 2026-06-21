import FeedCard from "./FeedCard";
import { posts } from "../../data/posts";

export default function Feed() {
  return (
    <div>
      {posts.map((post) => (
        <FeedCard
          key={post.id}
          post={post}
        />
      ))}
    </div>
  );
}