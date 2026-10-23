/**
 * Usage: ADMIN_PASSWORD='...' npm run admin:create -- owner@example.com [ADMIN|VIEWER]
 * The password is read from the environment so it does not end up in shell history or `ps` output.
 * Re-running for an existing email resets that user's password and role.
 */
import { PrismaClient, AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const role = (process.argv[3] ?? "ADMIN") as AdminRole;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Usage: ADMIN_PASSWORD=... npm run admin:create -- <email> [ADMIN|VIEWER]");
  if (!["ADMIN", "VIEWER"].includes(role)) throw new Error("Role must be ADMIN or VIEWER");
  if (password.length < 12) throw new Error("Password must be at least 12 characters");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({ where: { email }, update: { passwordHash, role }, create: { email, passwordHash, role } });
  console.log(`Admin user saved: ${email} (${role})`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
