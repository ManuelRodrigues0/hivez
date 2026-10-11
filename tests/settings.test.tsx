import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider, useTheme } from "../src/context/ThemeContext";
import Settings, {
  SettingsLayout,
  AccountSettings,
  PrivacySettings,
  SecuritySettings,
  NotificationsSettings,
  ContentPreferencesSettings,
  AppearanceSettings,
  AccessibilitySettings,
  LanguageSettings,
  DataSettings,
  DeleteAccountSettings,
} from "../src/pages/Settings/Settings";

const mocks = vi.hoisted(() => ({
  write: vi.fn(),
  logout: vi.fn(),
  push: vi.fn(),
  reauth: vi.fn(),
  email: vi.fn(),
  password: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  profile: {} as Record<string, unknown>,
  user: {
    uid: "isolated-test",
    email: "test@example.invalid",
    displayName: "Local Tester",
    providerData: [{ providerId: "password" }],
    metadata: { creationTime: "2024-01-01" },
  },
}));
vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user, profile: mocks.profile }),
}));
vi.mock("../src/firebase/firebase", () => ({
  db: {},
  auth: {},
  googleProvider: {},
}));
vi.mock("../src/services/auth", () => ({ logout: mocks.logout }));
vi.mock("../src/services/pushNotifications", () => ({
  enablePushNotifications: mocks.push,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("firebase/firestore", async (original) => ({
  ...(await original<typeof import("firebase/firestore")>()),
  doc: (...args: unknown[]) => args.slice(1).join("/"),
  collection: (...args: unknown[]) => args.slice(1).join("/"),
  setDoc: mocks.write,
  getDoc: vi.fn(async () => ({
    exists: () => true,
    data: () => mocks.profile,
  })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  query: (...args: unknown[]) => args,
}));
vi.mock("firebase/auth", async (original) => ({
  ...(await original<typeof import("firebase/auth")>()),
  reauthenticateWithCredential: mocks.reauth,
  updateEmail: mocks.email,
  updatePassword: mocks.password,
}));

const pages = {
  account: AccountSettings,
  privacy: PrivacySettings,
  security: SecuritySettings,
  notifications: NotificationsSettings,
  content: ContentPreferencesSettings,
  appearance: AppearanceSettings,
  accessibility: AccessibilitySettings,
  language: LanguageSettings,
  data: DataSettings,
  delete: DeleteAccountSettings,
};
function mount(path = "/settings") {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Settings />} />
            {Object.entries(pages).map(([key, Page]) => (
              <Route key={key} path={key} element={<Page />} />
            ))}
            <Route path="saved" element={<Navigate to="/saved" replace />} />
            <Route
              path="activity"
              element={<Navigate to="/activity" replace />}
            />
          </Route>
          <Route path="/saved" element={<h1>Saved destination</h1>} />
          <Route path="/activity" element={<h1>Activity destination</h1>} />
          <Route
            path="/profile/edit"
            element={<h1>Edit profile destination</h1>}
          />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}
beforeEach(() => {
  mocks.profile = {
    displayName: "Local Tester",
    username: "local",
    privacy: { account: "public", messages: "everyone", discoverable: true },
    notificationPreferences: { likes: false },
    preferences: {
      topics: ["Health"],
      interests: ["Mentorship"],
      sensitiveContent: "blur",
      language: "en-US",
    },
  };
  mocks.user.providerData = [{ providerId: "password" }];
  mocks.write.mockReset().mockResolvedValue(undefined);
  mocks.logout.mockReset().mockResolvedValue(undefined);
  mocks.reauth.mockReset().mockResolvedValue(undefined);
  mocks.email.mockReset().mockResolvedValue(undefined);
  mocks.password.mockReset().mockResolvedValue(undefined);
  mocks.push.mockReset().mockResolvedValue(undefined);
});

describe("Settings workspace", () => {
  it.each(Object.keys(pages))("renders the real %s section", (route) => {
    mount(`/settings/${route}`);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("navigation", { name: "Settings categories" }),
    ).toBeTruthy();
  });
  it("searches control terms, handles empty results, and clears with Escape", () => {
    mount();
    const input = screen.getByRole("searchbox", { name: "Find a setting" });
    fireEvent.change(input, { target: { value: "contrast" } });
    expect(screen.getByRole("status").textContent).toBe("1 category found");
    fireEvent.change(input, { target: { value: "not-a-setting" } });
    expect(screen.getByText("No settings found")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(
      screen.getByRole("heading", { name: "Your hive. Your way." }),
    ).toBeTruthy();
  });
  it("supports the search shortcut and mobile section navigation", () => {
    mount();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    fireEvent.change(screen.getByLabelText("Settings category"), {
      target: { value: "/settings/privacy" },
    });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Privacy",
    );
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 1 }),
    );
  });
  it("keeps an account form draft while searching", () => {
    mount("/settings/account");
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: "draft@example.invalid" },
    });
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "theme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(
      (screen.getByLabelText("New email address") as HTMLInputElement).value,
    ).toBe("draft@example.invalid");
  });
  it.each([
    ["saved", "Saved destination"],
    ["activity", "Activity destination"],
  ])("retains the %s redirect", (route, heading) => {
    mount(`/settings/${route}`);
    expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
  });
});

describe("Device preferences", () => {
  it("persists light/dark/system choices through remounting", () => {
    const view = mount("/settings/appearance");
    fireEvent.click(
      screen.getByRole("button", { name: /Light A fresh start/ }),
    );
    expect(localStorage.getItem("hivez-theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Dark A softer glow/ }));
    expect(localStorage.getItem("hivez-theme")).toBe("dark");
    fireEvent.click(
      screen.getByRole("button", { name: /System Follow your device/ }),
    );
    view.unmount();
    mount("/settings/appearance");
    expect(
      screen
        .getByRole("button", { name: /System Follow your device/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("synchronizes text size and reduced motion across pages and remounts", () => {
    const view = mount("/settings/appearance");
    fireEvent.click(screen.getByRole("button", { name: "Large", exact: true }));
    fireEvent.click(screen.getByRole("switch", { name: "Reduce motion" }));
    expect(localStorage.getItem("hivez-font-size")).toBe("large");
    expect(localStorage.getItem("hivez-reduced-motion")).toBe("true");
    view.unmount();
    mount("/settings/accessibility");
    expect(
      screen
        .getByRole("button", { name: "Large" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("switch", { name: "Reduce motion" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("switch", { name: "High contrast" }));
    expect(localStorage.getItem("hivez-high-contrast")).toBe("true");
    expect(document.documentElement.classList.contains("high-contrast")).toBe(
      true,
    );
  });
  it("updates React when the system theme changes", () => {
    const original = window.matchMedia;
    let isDark = false;
    let change: (() => void) | undefined;
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes("color-scheme") && isDark,
      addEventListener: (_type: string, callback: () => void) => {
        if (query.includes("color-scheme")) change = callback;
      },
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    localStorage.setItem("hivez-theme", "system");
    function Probe() {
      const { resolvedTheme } = useTheme();
      return <span data-testid="resolved">{resolvedTheme}</span>;
    }
    const view = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved").textContent).toBe("light");
    act(() => {
      isDark = true;
      change?.();
    });
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    view.unmount();
    window.matchMedia = original;
  });
});

describe("Isolated persistence and recovery", () => {
  it("preserves privacy rules and Firestore merge payloads", async () => {
    mount("/settings/privacy");
    fireEvent.click(
      screen.getByRole("button", { name: "Private", exact: true }),
    );
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith(
        "users/isolated-test",
        expect.objectContaining({
          privacy: expect.objectContaining({
            account: "private",
            messages: "followers",
          }),
          isPrivate: true,
          accountPrivacy: "private",
        }),
        { merge: true },
      ),
    );
  });
  it("rolls back a failed privacy save", async () => {
    mocks.write.mockRejectedValueOnce(new Error("offline"));
    mount("/settings/privacy");
    fireEvent.click(screen.getByRole("switch", { name: "Discoverability" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(
      screen
        .getByRole("switch", { name: "Discoverability" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });
  it("loads saved notification choices and merges a change", async () => {
    mount("/settings/notifications");
    const toggle = screen.getByRole("switch", { name: "Likes" });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith(
        "users/isolated-test",
        { notificationPreferences: { likes: true } },
        { merge: true },
      ),
    );
  });
  it("rolls back a failed notification change", async () => {
    mocks.write.mockRejectedValueOnce(new Error("offline"));
    mount("/settings/notifications");
    fireEvent.click(screen.getByRole("switch", { name: "Likes" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(
      screen
        .getByRole("switch", { name: "Likes" })
        .getAttribute("aria-checked"),
    ).toBe("false");
  });
  it("loads content selections and rolls back failed topic writes", async () => {
    mocks.write.mockRejectedValueOnce(new Error("offline"));
    mount("/settings/content");
    expect(
      screen.getByRole("button", { name: "Blur" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Health" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Technology" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(
      screen
        .getByRole("button", { name: "Technology" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });
  it("preserves sensitive content writes and rollback", async () => {
    mount("/settings/content");
    fireEvent.click(screen.getByRole("button", { name: "Hide", exact: true }));
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith(
        "users/isolated-test",
        expect.objectContaining({ preferences: { sensitiveContent: "hide" } }),
        { merge: true },
      ),
    );
    mocks.write.mockRejectedValueOnce(new Error("offline"));
    fireEvent.click(screen.getByRole("button", { name: "Show", exact: true }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: "Hide" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });
  it("exposes credential validation and preserves cancel behavior", async () => {
    mount("/settings/account");
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByRole("alert").textContent).toContain("current password");
    expect(mocks.password).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Confirm new password")).toBeNull();
  });
  it("keeps social provider credentials read-only", () => {
    mocks.user.providerData = [{ providerId: "google.com" }];
    mount("/settings/account");
    expect(
      screen.queryByRole("button", { name: "Change password" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Change email" })).toBeNull();
  });
  it("keeps the authenticated email update sequence and resets the form after success", async () => {
    mount("/settings/account");
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: "updated@example.invalid" },
    });
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "local-fixture-only" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update email" }));
    await waitFor(() =>
      expect(mocks.email).toHaveBeenCalledWith(
        mocks.user,
        "updated@example.invalid",
      ),
    );
    expect(mocks.reauth.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.email.mock.invocationCallOrder[0],
    );
    expect(screen.queryByLabelText("New email address")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(
      "Email updated successfully.",
    );
  });
  it("rejects password mismatch without calling authentication services", () => {
    mount("/settings/account");
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "fixture-current" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "fixture-next" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "different-fixture" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(screen.getByRole("alert").textContent).toContain("do not match");
    expect(mocks.reauth).not.toHaveBeenCalled();
    expect(mocks.password).not.toHaveBeenCalled();
  });
  it("keeps unavailable languages noninteractive", () => {
    mount("/settings/language");
    expect(
      screen
        .getByRole("button", { name: "Selected" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getAllByText("Soon")).toHaveLength(2);
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("exports the existing profile and settings structure using isolated reads", async () => {
    const download = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const createUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:isolated-export");
    const revokeUrl = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});
    mount("/settings/data");
    fireEvent.click(
      screen.getByRole("button", { name: "Export", exact: true }),
    );
    await waitFor(() => expect(createUrl).toHaveBeenCalledOnce());
    const payload = JSON.parse(
      await (createUrl.mock.calls[0][0] as Blob).text(),
    );
    expect(payload.settings.privacy.account).toBe("public");
    expect(payload.profile.displayName).toBe("Local Tester");
    expect(payload).toEqual(
      expect.objectContaining({
        posts: [],
        comments: [],
        follows: { followers: [], following: [] },
      }),
    );
    expect(download).toHaveBeenCalledOnce();
    expect(mocks.write).not.toHaveBeenCalled();
    download.mockRestore();
    createUrl.mockRestore();
    revokeUrl.mockRestore();
  });
  it("requires cache confirmation and preserves user data", async () => {
    localStorage.setItem("hivez-local-chats:isolated-test", "precious");
    localStorage.setItem("unrelated", "keep");
    localStorage.setItem("hivez.last-map-center", "cache");
    mount("/settings/data");
    fireEvent.click(screen.getByRole("button", { name: "Clear cache" }));
    let dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(localStorage.getItem("hivez.last-map-center")).toBe("cache");
    fireEvent.click(screen.getByRole("button", { name: "Clear cache" }));
    dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Clear cache" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(localStorage.getItem("hivez.last-map-center")).toBeNull();
    expect(localStorage.getItem("hivez-local-chats:isolated-test")).toBe(
      "precious",
    );
    expect(localStorage.getItem("unrelated")).toBe("keep");
    expect(localStorage.getItem("hivez-theme")).toBe("dark");
  });
  it("keeps account closure unavailable and confirms sign-out accurately", async () => {
    mount("/settings/delete");
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Sign out", exact: true }),
    );
    let dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("does not deactivate or delete");
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(mocks.logout).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Sign out", exact: true }),
    );
    dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledOnce());
  });
});
