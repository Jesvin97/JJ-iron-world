import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, adminFromToken } from "./auth";

/** Server-side guard for admin pages. Call from EVERY admin page, not just the layout. */
export async function requirePageAdmin() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const admin = await adminFromToken(token);
  if (!admin) redirect("/admin/login");
  return admin;
}
