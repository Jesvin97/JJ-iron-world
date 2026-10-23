import type { SalonSettings } from "@prisma/client";
import { db } from "./db";
import { usableReviewUrl } from "./google-url";

const DEFAULT_NAME = "Glam’more Premium Unisex Salon & Spa";

/** Get the single settings row, creating it from environment defaults on first use. */
export async function getSettings(): Promise<SalonSettings> {
  const existing = await db.salonSettings.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return db.salonSettings.create({
    data: {
      id: "singleton",
      businessName: process.env.SALON_NAME || DEFAULT_NAME,
      googleReviewUrl: process.env.GOOGLE_REVIEW_URL || null,
      aiProvider: process.env.AI_PROVIDER || "anthropic",
      aiModel: process.env.AI_MODEL || "claude-haiku-5-5",
    },
  });
}

/** The only settings fields exposed to customers. */
export function toPublicSettings(s: SalonSettings) {
  return {
    businessName: s.businessName,
    googleReviewUrl: usableReviewUrl(s.googleReviewUrl),
    aiEnabled: s.aiEnabled && s.aiProvider !== "none",
    contactEmail: s.contactEmail,
  };
}
