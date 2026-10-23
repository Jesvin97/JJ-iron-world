import { SESSION_COOKIE, sessionCookieOptions, signSession, verifyCredentials } from "@/lib/auth";
import { apiError, json, limited, parseBody, sameOriginOk } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOriginOk(req)) return apiError(403, "bad_origin", "Cross-origin request blocked");
  const rl = limited(req, "login", LIMITS.login);
  if (rl) return rl;
  const body = await parseBody(req, loginSchema, 1024);
  if ("response" in body) return body.response;

  // Second limiter per target account slows distributed guessing against one email.
  const acct = rateLimit(`login-acct:${body.data.email}`, 10, LIMITS.login.windowMs);
  if (!acct.ok) {
    const res = apiError(429, "rate_limited", "Too many sign-in attempts. Please try again later.", { retryAfterSeconds: acct.retryAfterSeconds });
    res.headers.set("Retry-After", String(acct.retryAfterSeconds));
    return res;
  }

  const user = await verifyCredentials(body.data.email, body.data.password);
  if (!user) return apiError(401, "invalid_credentials", "Incorrect email or password");

  const res = json({ ok: true, role: user.role });
  res.cookies.set(SESSION_COOKIE, await signSession(user), sessionCookieOptions());
  return res;
}
