/** Copies text from a user gesture using modern clipboard access or browser fallback. */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the legacy API for browsers that deny the permission.
    }
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  try {
    input.select();
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Clipboard access is unavailable in this browser.");
  } finally {
    input.remove();
  }
}
