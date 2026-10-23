import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const E2E_DB = process.env.E2E_DATABASE_URL || "postgresql://glamore:glamore@localhost:5432/glamore_e2e?schema=public";

import { ADMIN, GOOGLE_URL } from "./prepare-constants";

async function prepare() {
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: E2E_DB } });
  const prisma = new PrismaClient({ datasources: { db: { url: E2E_DB } } });
  await prisma.$executeRawUnsafe(
    'TRUNCATE "FeedbackSubmission","ReviewSession","Campaign","AdminUser","SalonSettings" RESTART IDENTITY CASCADE',
  );
  await prisma.salonSettings.create({
    data: { id: "singleton", businessName: "Glam’more Premium Unisex Salon & Spa", googleReviewUrl: GOOGLE_URL, aiProvider: "mock" },
  });
  await prisma.campaign.create({ data: { slug: "reception", name: "Reception desk" } });
  await prisma.adminUser.create({ data: { ...{ email: ADMIN.email }, passwordHash: await bcrypt.hash(ADMIN.password, 10), role: "ADMIN" } });
  await prisma.$disconnect();
}

prepare().catch((e) => {
  console.error(e);
  process.exit(1);
});
