import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "../src/context/ThemeContext";
import PublicThemeToggle from "../src/components/common/PublicThemeToggle";
import CompleteProfile from "../src/pages/CompleteProfile/CompleteProfile";
import { saveCompletedProfile, uploadOnboardingPhoto } from "../src/services/completeProfile";

const mocks = vi.hoisted(() => ({
  read: vi.fn(), write: vi.fn(), refresh: vi.fn(),
  user: { uid: "isolated-profile-test", displayName: "Local Neighbour" },
}));
vi.mock("../src/firebase/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...path: string[]) => path.join("/"),
  getDoc: mocks.read,
  setDoc: mocks.write,
}));
vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user, refreshProfileStatus: mocks.refresh }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  localStorage.setItem("hivez-reduced-motion", "true");
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  mocks.read.mockResolvedValue({ exists: () => false });
  mocks.write.mockResolvedValue(undefined);
  mocks.refresh.mockResolvedValue(undefined);
});
const draft = { username: " @@Neighbour ", bio: "Local action.", photoURL: "/avatars/example.jpg" };

describe("Existing onboarding persistence contract", () => {
  it("normalizes the handle, retains public privacy defaults and reserves the username", async () => {
    await saveCompletedProfile(mocks.user, draft);
    expect(mocks.read).toHaveBeenCalledWith("usernames/neighbour");
    expect(mocks.write.mock.calls).toEqual([
      ["users/isolated-profile-test", {
        username: "neighbour", usernameLower: "neighbour", displayNameLower: "local neighbour",
        bio: "Local action.", photoURL: "/avatars/example.jpg",
        privacy: { account: "public", messages: "everyone", mentions: "everyone", comments: "everyone", discoverable: true },
        accountPrivacy: "public", isPrivate: false, profileCompleted: true,
      }, { merge: true }],
      ["usernames/neighbour", { uid: "isolated-profile-test" }],
    ]);
  });
  it("never writes when a username is unavailable", async () => {
    mocks.read.mockResolvedValue({ exists: () => true });
    await expect(saveCompletedProfile(mocks.user, draft)).rejects.toMatchObject({ code: "profile/username-taken" });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("rejects short handles before any database request", async () => {
    await expect(saveCompletedProfile(mocks.user, { ...draft, username: "@ab" })).rejects.toThrow("at least 3");
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("propagates lookup and write failures so the UI can recover", async () => {
    mocks.read.mockRejectedValueOnce(new Error("lookup offline"));
    await expect(saveCompletedProfile(mocks.user, draft)).rejects.toThrow("lookup offline");
    expect(mocks.write).not.toHaveBeenCalled();
    mocks.write.mockRejectedValueOnce(new Error("write offline"));
    await expect(saveCompletedProfile(mocks.user, draft)).rejects.toThrow("write offline");
    expect(mocks.write).toHaveBeenCalledTimes(1);
  });
  it("submits the original upload endpoint, file and preset and checks the returned URL", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ secure_url: "https://example.invalid/photo.jpg" }) });
    vi.stubGlobal("fetch", fetcher);
    const file = new File(["photo"], "photo.png", { type: "image/png" });
    await expect(uploadOnboardingPhoto(file)).resolves.toBe("https://example.invalid/photo.jpg");
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://api.cloudinary.com/v1_1/dpotccr5q/image/upload");
    expect(options.method).toBe("POST");
    expect(options.body.get("upload_preset")).toBe("hivez_upload");
    expect(options.body.get("file").name).toBe("photo.png");
    fetcher.mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(uploadOnboardingPhoto(file)).rejects.toThrow("upload failed");
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ secure_url: "http://example.invalid/photo.jpg" }) });
    await expect(uploadOnboardingPhoto(file)).rejects.toThrow("upload failed");
  });
});

describe("Connected profile completion and shared theme preference", () => {
  function mountProfile() {
    return render(<MemoryRouter><ThemeProvider><CompleteProfile /></ThemeProvider></MemoryRouter>);
  }
  it("saves once and refreshes the existing profile gate after success", async () => {
    mountProfile();
    fireEvent.change(screen.getByLabelText(/Choose your username/), { target: { value: "Neighbour" } });
    fireEvent.change(screen.getByLabelText(/A little about you/), { target: { value: "Here to help." } });
    fireEvent.submit(document.querySelector("#cp-form")!);
    fireEvent.submit(document.querySelector("#cp-form")!);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.write).toHaveBeenCalledTimes(2);
    expect(mocks.write.mock.calls[0][1]).toMatchObject({ bio: "Here to help.", username: "neighbour" });
  });
  it("recovers from lookup errors without dropping entered details or refreshing the gate", async () => {
    mocks.read.mockRejectedValueOnce(new Error("offline"));
    mountProfile();
    const username = screen.getByLabelText(/Choose your username/);
    fireEvent.change(username, { target: { value: "Neighbour" } });
    fireEvent.submit(document.querySelector("#cp-form")!);
    await screen.findByRole("alert");
    expect((screen.getByRole("button", { name: "Enter my hive" }) as HTMLButtonElement).disabled).toBe(false);
    expect((username as HTMLInputElement).value).toBe("Neighbour");
    expect(mocks.refresh).not.toHaveBeenCalled();
    fireEvent.submit(document.querySelector("#cp-form")!);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });
  it("cycles three public palettes and keeps the authenticated app preference intact", async () => {
    localStorage.setItem("hivez-theme", "dark");
    localStorage.setItem("hivez-public-theme", "light");
    render(<ThemeProvider><PublicThemeToggle /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Theme: Warm light. Switch to Forest" }));
    expect(localStorage.getItem("hivez-public-theme")).toBe("forest");
    fireEvent.click(screen.getByRole("button", { name: "Theme: Forest. Switch to Black & yellow" }));
    expect(localStorage.getItem("hivez-public-theme")).toBe("midnight");
    fireEvent.click(screen.getByRole("button", { name: "Theme: Black & yellow. Switch to Warm light" }));
    expect(localStorage.getItem("hivez-public-theme")).toBe("light");
    expect(localStorage.getItem("hivez-theme")).toBe("dark");
  });
});
