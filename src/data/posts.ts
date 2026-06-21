export interface Post {
  id: number;
  username: string;
  handle: string;
  avatar: string;
  time: string;
  content: string;
  image?: string;
  likes: number;
  comments: number;
  reposts: number;
}

export const posts: Post[] = [
  {
    id: 1,
    username: "Elon Musk",
    handle: "@elonmusk",
    avatar: "https://i.pravatar.cc/150?img=1",
    time: "2h",
    content:
      "Just testing Hivez. Looks pretty cool 🐝",
    image: "https://picsum.photos/600/500?random=1",
    likes: 2487,
    comments: 328,
    reposts: 149,
  },
  {
    id: 2,
    username: "John",
    handle: "@john",
    avatar: "https://i.pravatar.cc/150?img=2",
    time: "5h",
    content:
      "Threads UI clone is almost finished 😎",
    likes: 842,
    comments: 42,
    reposts: 12,
  },
  {
    id: 3,
    username: "Sarah",
    handle: "@sarah",
    avatar: "https://i.pravatar.cc/150?img=3",
    time: "7h",
    content:
      "Can't wait to replace likes with upvotes!",
    image: "https://picsum.photos/600/500?random=2",
    likes: 1024,
    comments: 81,
    reposts: 29,
  },
];