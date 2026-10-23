import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { appUrl } from "./env";
import { clientKey, rateLimit, type LIMITS } from "./rate-limit";

export function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

export function apiError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export const MAX_BODY_BYTES = 16 * 1024;

/** Parse a JSON body with a size cap and Zod validation. Returns either data or a ready error response. */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>,
  maxBytes = MAX_BODY_BYTES,
): Promise<{ data: T } | { response: NextResponse }> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) return { response: apiError(413, "payload_too_large", "Request is too large") };
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("application/json")) {
    return { response: apiError(415, "unsupported_media_type", "Expected application/json") };
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return { response: apiError(400, "bad_request", "Could not read request body") };
  }
  if (new TextEncoder().encode(raw).length > maxBytes) {
    return { response: apiError(413, "payload_too_large", "Request is too large") };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { response: apiError(400, "invalid_json", "Request body is not valid JSON") };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) return { response: validationError(result.error) };
  return { data: result.data };
}

export function validationError(err: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in fields)) fields[key] = issue.message;
  }
  return apiError(400, "validation_error", "Please check the highlighted fields", { fields });
}

/** Apply a named per-client limit. Returns an error response when exceeded. */
export function limited(req: Request, name: keyof typeof LIMITS, cfg: { limit: number; windowMs: number }, suffix = "") {
  const r = rateLimit(`${name}:${clientKey(req)}${suffix}`, cfg.limit, cfg.windowMs);
  if (r.ok) return null;
  const res = apiError(429, "rate_limited", "Too many requests. Please try again shortly.", {
    retryAfterSeconds: r.retryAfterSeconds,
  });
  res.headers.set("Retry-After", String(r.retryAfterSeconds));
  return res;
}

/**
 * CSRF defence for cookie-authenticated mutations: besides SameSite=Strict cookies, a browser-supplied
 * Origin must match the configured app origin (or the request host when APP_URL is unset).
 */
export function sameOriginOk(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients; cookies are SameSite=Strict regardless
  let o: URL;
  try {
    o = new URL(origin);
  } catch {
    return false;
  }
  const configured = appUrl();
  if (configured) {
    try {
      if (new URL(configured).host === o.host) return true;
    } catch {
      /* fall through */
    }
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  return !!host && host === o.host;
}
