import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// DOM-only tests: no browser layout or native dialog focus behavior is claimed.
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute("open", "");
};
HTMLDialogElement.prototype.close = function () {
  this.removeAttribute("open");
};
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});
