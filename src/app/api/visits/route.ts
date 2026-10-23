import { db } from "@/lib/db";
import { apiError, json, limited, parseBody } from "@/lib/http";
import { LIMITS } from "@/lib/rate-limit";
import { visitSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Records the visit details a customer chose to share (services, and name/phone with consent) so the team can follow up.
 * It never decides what the customer sees: every rating gets the same Google link.
 * Ratings 1-3 are always recorded for team follow-up (no personal data without consent); 4-5 only when the customer opts in.
 */
export async function POST(req: Request) {
  const rl = limited(req, "visit", LIMITS.visit);
  if (rl) return rl;
  const body = await parseBody(req, visitSchema, 8 * 1024);
  if ("response" in body) return body.response;
  const v = body.data;

  const session = await db.reviewSession.findUnique({ where: { id: v.sessionId }, select: { campaignId: true } });
  if (!session) return apiError(404, "not_found", "Session not found");
  if (v.rating >= 4 && !v.contactConsent) return json({ ok: true, stored: false });

  await db.feedbackSubmission.create({
    data: {
      rating: v.rating,
      originalText: null,
      customerName: v.name,
      customerPhone: v.phone,
      contactConsent: v.contactConsent,
      services: v.services,
      campaignId: session.campaignId,
      // Only low ratings need the team's attention; opted-in 4-5★ contacts are filed as already handled.
      status: v.rating <= 3 ? "NEW" : "RESOLVED",
    },
  });
  return json({ ok: true, stored: true }, 201);
}
