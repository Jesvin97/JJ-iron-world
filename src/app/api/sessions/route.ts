import { db } from "@/lib/db";
import { apiError, json, limited, parseBody } from "@/lib/http";
import { LIMITS } from "@/lib/rate-limit";
import { createSessionSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** A reload of the same tab within this window reuses the session so scans are not inflated. */
const DEDUPE_MS = 30 * 60_000;

export async function POST(req: Request) {
  const rl = limited(req, "session", LIMITS.session);
  if (rl) return rl;
  const body = await parseBody(req, createSessionSchema, 1024);
  if ("response" in body) return body.response;
  const { anonymousSessionId, campaign } = body.data;

  const existing = await db.reviewSession.findFirst({
    where: { anonymousSessionId, createdAt: { gte: new Date(Date.now() - DEDUPE_MS) } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) return json({ sessionId: existing.id });

  // Unknown or inactive campaigns are simply ignored; they must never block a customer.
  const camp = campaign ? await db.campaign.findFirst({ where: { slug: campaign, active: true }, select: { id: true } }) : null;
  const created = await db.reviewSession.create({
    data: { anonymousSessionId, campaignId: camp?.id ?? null },
    select: { id: true },
  });
  return json({ sessionId: created.id }, 201);
}

export function GET() {
  return apiError(405, "method_not_allowed", "Method not allowed");
}
