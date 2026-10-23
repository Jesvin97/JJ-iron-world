import { db } from "@/lib/db";
import { json, limited, parseBody } from "@/lib/http";
import { notifyNewFeedback } from "@/lib/notify";
import { LIMITS } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { feedbackSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Private feedback. Public, untrusted input; accepted for every rating and independent of the Google link. */
export async function POST(req: Request) {
  const rl = limited(req, "feedback", LIMITS.feedback);
  if (rl) return rl;
  const body = await parseBody(req, feedbackSchema, 8 * 1024);
  if ("response" in body) return body.response;
  const f = body.data;

  let campaignId: string | null = null;
  if (f.sessionId) {
    campaignId = (await db.reviewSession.findUnique({ where: { id: f.sessionId }, select: { campaignId: true } }))?.campaignId ?? null;
  } else if (f.campaign) {
    campaignId = (await db.campaign.findUnique({ where: { slug: f.campaign }, select: { id: true } }))?.id ?? null;
  }

  const created = await db.feedbackSubmission.create({
    data: {
      rating: f.rating,
      originalText: f.text,
      customerName: f.name,
      customerEmail: f.email,
      customerPhone: f.phone,
      contactConsent: f.contactConsent,
      campaignId,
    },
    select: { id: true, rating: true },
  });

  void notifyNewFeedback(await getSettings(), created);
  // Only an acknowledgement is returned; nothing from other submissions or internal fields.
  return json({ ok: true }, 201);
}
