import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  user: { uid: "neighbour-1", displayName: "Neighbour", photoURL: "" } as null | { uid: string; displayName: string; photoURL: string },
  profile: { username: "neighbour", displayName: "Neighbour", photoURL: "" },
  transaction: vi.fn(),
  onSnapshot: vi.fn(),
  engagement: vi.fn(),
  toggleReHive: vi.fn(),
  toggleSavePost: vi.fn(),
  getUserSummary: vi.fn(),
  createCommunity: vi.fn(),
  joinCommunity: vi.fn(),
  clipboard: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user, profile: mocks.profile }),
}));
vi.mock("../src/context/ThemeContext", () => ({ useTheme: () => ({ reducedMotion: true }) }));
vi.mock("../src/firebase/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  increment: (value: number) => ({ increment: value }),
  onSnapshot: mocks.onSnapshot,
  runTransaction: mocks.transaction,
  deleteDoc: vi.fn(),
  updateDoc: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("../src/hooks/useLiveProfile", () => ({ useLiveProfile: (_uid: string, post: unknown) => post }));
vi.mock("../src/services/notifications", () => ({ createNotification: vi.fn() }));
vi.mock("../src/services/engagementEvents", () => ({ recordPostEngagement: mocks.engagement }));
vi.mock("../src/services/clipboard", () => ({ copyTextToClipboard: mocks.clipboard }));
vi.mock("../src/services/volunteering", () => ({
  createIssueCommunityForPost: mocks.createCommunity,
  getUserSummary: mocks.getUserSummary,
  joinIssueCommunity: mocks.joinCommunity,
  listenCommunityByPost: (_postId: string, onNext: (community: null) => void) => {
    onNext(null);
    return vi.fn();
  },
  listenCommunityMember: (_communityId: string, _uid: string, onNext: (member: null) => void) => {
    onNext(null);
    return vi.fn();
  },
}));
vi.mock("../src/services/rehives", () => ({
  listenToReHiveState: (_uid: string, _postId: string, onNext: (active: boolean) => void) => {
    onNext(false);
    return vi.fn();
  },
  toggleReHive: mocks.toggleReHive,
}));
vi.mock("../src/services/savedPosts", () => ({
  listenToSavedPostState: (_uid: string, _postId: string, onNext: (saved: boolean) => void) => {
    onNext(false);
    return vi.fn();
  },
  toggleSavePost: mocks.toggleSavePost,
}));
vi.mock("../src/services/blocks", () => ({ blockIdFor: (a: string, b: string) => `${a}_${b}`, blockUser: vi.fn(), unblockUser: vi.fn() }));
vi.mock("../src/services/admin", () => ({ createReport: vi.fn() }));
vi.mock("../src/components/feed/MediaGrid", () => ({ default: () => null }));
vi.mock("../src/components/comments/CommentsSheet", () => ({
  default: ({ open }: { open: boolean }) => open ? <div role="dialog" aria-label="Comments panel">Comments are open</div> : null,
}));
vi.mock("../src/components/feed/PostSendSheet", () => ({
  default: ({ open }: { open: boolean }) => open ? <div role="dialog" aria-label="Send post via direct message">Send post</div> : null,
}));
vi.mock("framer-motion", () => ({ motion: { div: "div" } }));

import FeedCard from "../src/components/feed/FeedCard";

const post = {
  id: "issue-1",
  uid: "author-1",
  username: "author",
  displayName: "Author",
  photoURL: "",
  caption: "A fallen branch is blocking the path.",
  category: "roads",
  likes: 2,
  comments: 3,
  reHives: 0,
  mediaUrls: [],
  createdAt: null,
} as never;

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="route">{location.pathname}</output>;
}

function mount(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <FeedCard post={post} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { uid: "neighbour-1", displayName: "Neighbour", photoURL: "" };
  mocks.profile = { username: "neighbour", displayName: "Neighbour", photoURL: "" };
  mocks.onSnapshot.mockImplementation((_ref, next) => {
    next({ exists: () => false, data: () => ({}) });
    return vi.fn();
  });
  mocks.transaction.mockImplementation(async (_db, update) => update({
    get: async (ref: string) => ({ exists: () => ref === "posts/issue-1", data: () => post }),
    set: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  }));
  mocks.toggleReHive.mockResolvedValue({ active: true });
  mocks.toggleSavePost.mockResolvedValue({ saved: true });
  mocks.engagement.mockResolvedValue(undefined);
  mocks.getUserSummary.mockImplementation(async (uid: string) => ({ uid, username: uid, displayName: uid, photoURL: "" }));
  mocks.createCommunity.mockResolvedValue("community-1");
  mocks.joinCommunity.mockResolvedValue(undefined);
  mocks.clipboard.mockResolvedValue(undefined);
});

describe("feed post actions", () => {
  it("wires like, comments, ReHive, volunteer, save, share, and DM controls", async () => {
    mount();

    fireEvent.click(screen.getByRole("button", { name: "Like post" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Unlike post" }).getAttribute("aria-pressed")).toBe("true"));
    expect(mocks.transaction).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Comments" }));
    expect(screen.getByRole("dialog", { name: "Comments panel" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "ReHive post" }));
    await waitFor(() => expect(mocks.toggleReHive).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove ReHive" }).getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(screen.getByRole("button", { name: "Volunteer" }));
    await waitFor(() => expect(mocks.joinCommunity).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/issue-community/community-1"));

    fireEvent.click(screen.getByRole("button", { name: "Save post" }));
    await waitFor(() => expect(mocks.toggleSavePost).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove from saved posts" }).getAttribute("aria-pressed")).toBe("true"));

    fireEvent.click(screen.getByRole("button", { name: "Share post" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    await waitFor(() => expect(mocks.clipboard).toHaveBeenCalledWith(expect.stringContaining("/post/issue-1")));

    fireEvent.click(screen.getByRole("button", { name: "Send post via direct message" }));
    expect(screen.getByRole("dialog", { name: "Send post via direct message" })).not.toBeNull();
  });

  it("routes signed-out engagement actions to login instead of silently doing nothing", async () => {
    mocks.user = null;
    const view = mount("/feed");

    fireEvent.click(screen.getByRole("button", { name: "Like post" }));
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/login"));
    view.unmount();

    const secondView = mount("/feed");
    fireEvent.click(screen.getByRole("button", { name: "ReHive post" }));
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/login"));
    secondView.unmount();

    const thirdView = mount("/feed");
    fireEvent.click(screen.getByRole("button", { name: "Save post" }));
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/login"));
    thirdView.unmount();

    mount("/feed");
    fireEvent.click(screen.getByRole("button", { name: "Send post via direct message" }));
    await waitFor(() => expect(screen.getByTestId("route").textContent).toBe("/login"));
  });
});
