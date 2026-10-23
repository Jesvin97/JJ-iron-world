/**
 * The Google review link is the only external destination the customer page links to, so it is
 * restricted to Google-owned hosts. This limits the damage if an admin account is ever abused.
 */
const ALLOWED_HOSTS = new Set([
  "search.google.com",
  "www.google.com",
  "google.com",
  "g.page",
  "maps.app.goo.gl",
  "goo.gl",
  "share.google",
  "g.co",
]);

export function isPlaceholderReviewUrl(url: string): boolean {
  return /YOUR_PLACE_ID/i.test(url);
}

export function validateGoogleReviewUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, error: "Enter a valid URL" };
  }
  if (u.protocol !== "https:") return { ok: false, error: "The Google review URL must use https" };
  if (!ALLOWED_HOSTS.has(u.hostname.toLowerCase())) {
    return { ok: false, error: "The URL must be an official Google link (e.g. search.google.com or g.page)" };
  }
  if (isPlaceholderReviewUrl(u.href)) {
    return { ok: false, error: "Replace YOUR_PLACE_ID with the salon's real Place ID" };
  }
  return { ok: true, url: u.href };
}

/** Returns a usable review URL or null (unset, malformed, off-allowlist or still a placeholder). */
export function usableReviewUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const r = validateGoogleReviewUrl(raw);
  return r.ok ? r.url : null;
}
