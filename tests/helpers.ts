import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { resetRateLimits } from "@/lib/rate-limit";
import { POST as login } from "@/app/api/admin/login/route";

export async function resetDb() {
  await db.$executeRawUnsafe(
    'TRUNCATE "PublicReview","FeedbackSubmission","ReviewSession","Campaign","AdminUser","SalonSettings" RESTART IDENTITY CASCADE',
  );
  resetRateLimits();
}

let ipCounter = 0;
/** Each request gets a distinct client IP unless one is given, so limiter tests stay isolated. */
export function req(
  path: string,
  opts: { method?: string; body?: unknown; cookie?: string; ip?: string; headers?: Record<string, string>; raw?: string } = {},
) {
  const headers: Record<string, string> = {
    "x-forwarded-for": opts.ip ?? `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`,
    ...opts.headers,
  };
  if (opts.body !== undefined || opts.raw !== undefined) headers["content-type"] = "application/json";
  if (opts.cookie) headers.cookie = opts.cookie;
  return new Request(`https://reviews.example.test${path}`, {
    method: opts.method ?? (opts.body !== undefined || opts.raw !== undefined ? "POST" : "GET"),
    headers,
    body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
}

export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

export async function createAdmin(email = "owner@example.test", role: "ADMIN" | "VIEWER" = "ADMIN", password = "correct-horse-battery") {
  await db.adminUser.create({ data: { email, role, passwordHash: await hashPassword(password) } });
  return { email, password };
}

export async function loginCookie(email: string, password: string) {
  const res = await login(req("/api/admin/login", { body: { email, password } }));
  if (res.status !== 200) throw new Error(`login failed: ${res.status}`);
  return res.headers.get("set-cookie")!.split(";")[0];
}

export async function newSession(anon = "anon-session-0123456789", campaign?: string) {
  const { POST } = await import("@/app/api/sessions/route");
  const res = await POST(req("/api/sessions", { body: { anonymousSessionId: anon, campaign } }));
  return (await res.json()).sessionId as string;
}
