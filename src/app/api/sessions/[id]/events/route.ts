import { db } from "@/lib/db";
import { apiError, json, limited, parseBody } from "@/lib/http";
import { LIMITS } from "@/lib/rate-limit";
import { sessionEventSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Records aggregate funnel events only. Flags are idempotent, so retries never inflate counts. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = limited(req, "event", LIMITS.event);
  if (rl) return rl;
  const { id } = await params;
  const body = await parseBody(req, sessionEventSchema, 1024);
  if ("response" in body) return body.response;
  const { type, rating } = body.data;

  if (type === "rating" && rating === undefined) {
    return apiError(400, "validation_error", "rating is required", { fields: { rating: "Required" } });
  }
  const data =
    type === "rating" ? { rating } : type === "copy" ? { reviewCopied: true } : { googleLinkClicked: true };
  const res = await db.reviewSession.updateMany({ where: { id }, data });
  if (res.count === 0) return apiError(404, "not_found", "Session not found");
  return json({ ok: true });
}
