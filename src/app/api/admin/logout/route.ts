import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { apiError, json, sameOriginOk } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOriginOk(req)) return apiError(403, "bad_origin", "Cross-origin request blocked");
  const res = json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
  return res;
}
