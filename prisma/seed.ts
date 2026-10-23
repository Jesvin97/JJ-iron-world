import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const businessName = process.env.SALON_NAME || "Glam’more Premium Unisex Salon & Spa";
  const googleReviewUrl = process.env.GOOGLE_REVIEW_URL || null;

  // Existing settings are left untouched so re-seeding never overwrites admin edits.
  await prisma.salonSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      businessName,
      googleReviewUrl,
      aiProvider: process.env.AI_PROVIDER || "anthropic",
      aiModel: process.env.AI_MODEL || "claude-haiku-5-5",
    },
  });

  for (const [slug, name] of [
    ["reception", "Reception desk"],
    ["checkout", "Checkout counter"],
    ["mirror", "Styling mirrors"],
  ]) {
    await prisma.campaign.upsert({ where: { slug }, update: {}, create: { slug, name } });
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");
    await prisma.adminUser.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash: await bcrypt.hash(password, 12), role: "ADMIN" },
    });
    console.log(`Admin user ready: ${email}`);
  } else {
    console.log("ADMIN_EMAIL/ADMIN_PASSWORD not set - create an admin with `npm run admin:create`.");
  }
  console.log("Seed complete.");
}

main().finally(() => prisma.$disconnect());
