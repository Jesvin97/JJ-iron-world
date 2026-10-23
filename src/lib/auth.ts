import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import type { AdminRole } from "@prisma/client";
import { authSecret, isProd } from "./env";
import { db } from "./db";
import { apiError, limited, sameOriginOk } from "./http";
import { LIMITS } from "./rate-limit";

export const SESSION_COOKIE = "glamore_admin";
const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type AdminIdentity = { id: string; email: string; role: AdminRole };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

// Compared against when the email is unknown so login timing does not reveal valid accounts.
let dummyHash: string | null = null;
function getDummyHash() {
  return (dummyHash ??= bcrypt.hashSync("not-a-real-password", 12));
}

export async function verifyCredentials(email: string, password: string): Promise<AdminIdentity | null> {
  const user = await db.adminUser.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? getDummyHash());
  if (!user || !ok) return null;
  return { id: user.id, email: user.email, role: user.role };
}

export async function signSession(user: AdminIdentity): Promise<string> {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(authSecret());
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: isProd(),
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}

export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

/** Verifies the token AND re-reads the user, so deleted/demoted admins lose access immediately. */
export async function adminFromToken(token: string | null | undefined): Promise<AdminIdentity | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const user = await db.adminUser.findUnique({ where: { id: payload.sub } });
    return user ? { id: user.id, email: user.email, role: user.role } : null;
  } catch {
    return null;
  }
}

/**
 * Guard for admin API routes. Usage:
 *   const a = await requireAdmin(req, { write: true }); if ("response" in a) return a.response;
 * `write` demands the ADMIN role and a same-origin request (CSRF defence in depth).
 */
export async function requireAdmin(
  req: Request,
  opts: { write?: boolean } = {},
): Promise<{ admin: AdminIdentity } | { response: Response }> {
  const rl = limited(req, "admin", LIMITS.admin);
  if (rl) return { response: rl };
  const admin = await adminFromToken(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  if (!admin) return { response: apiError(401, "unauthorized", "Please sign in") };
  if (opts.write) {
    if (!sameOriginOk(req)) return { response: apiError(403, "bad_origin", "Cross-origin request blocked") };
    if (admin.role !== "ADMIN") return { response: apiError(403, "forbidden", "Your role cannot make changes") };
  }
  return { admin };
}
