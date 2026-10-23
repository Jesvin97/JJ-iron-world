/**
 * Copy text to the clipboard. Resolves to "copied" or "failed" and never throws, so the UI can
 * show a manual-copy hint when permissions are denied or the API is unavailable (e.g. in-app browsers).
 */
export async function copyText(text: string): Promise<"copied" | "failed"> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    if (typeof document === "undefined") return "failed";
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok ? "copied" : "failed";
  } catch {
    return "failed";
  }
}
