import { db } from "@/lib/db";
import { AiUnavailableError, MIN_INPUT_CHARS, scrubPersonalData, suggestReview } from "@/lib/ai";
import { intEnv } from "@/lib/env";
import { apiError, json, limited, parseBody } from "@/lib/http";
import { LIMITS } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { suggestSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const UNAVAILABLE = "Suggestions are unavailable right now. You can still write your own review below.";

export async function POST(req: Request) {
  const rl = limited(req, "suggest", LIMITS.suggest);
  if (rl) return rl;
  const body = await parseBody(req, suggestSchema, 8 * 1024);
  if ("response" in body) return body.response;
  const { sessionId, rating, text, shorter, services } = body.data;

  const session = await db.reviewSession.findUnique({ where: { id: sessionId }, select: { id: true } });
  if (!session) return apiError(404, "not_found", "Session not found");

  const settings = await getSettings();
  const cfg = { provider: settings.aiProvider, model: settings.aiModel, enabled: settings.aiEnabled };
  if (!cfg.enabled || cfg.provider === "none") return apiError(503, "ai_unavailable", UNAVAILABLE);

  // Input too thin to write from: ask for detail without spending a provider call.
  if (scrubPersonalData(text).length < MIN_INPUT_CHARS) {
    return json({
      status: "needs_more_detail",
      message: "Tell us a little about your visit and we'll help you put it into words.",
    });
  }

  // Cost controls: daily cap across the site and a per-session cap, checked before any provider call.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const today = await db.reviewSession.aggregate({
    where: { createdAt: { gte: startOfDay } },
    _sum: { aiGenerationCount: true },
  });
  if ((today._sum.aiGenerationCount ?? 0) >= intEnv("AI_DAILY_LIMIT", 300)) {
    return apiError(503, "ai_unavailable", UNAVAILABLE);
  }
  // Atomic increment guarded by the per-session cap.
  const claimed = await db.reviewSession.updateMany({
    where: { id: sessionId, aiGenerationCount: { lt: intEnv("AI_MAX_PER_SESSION", 5) } },
    data: { aiGenerationCount: { increment: 1 } },
  });
  if (claimed.count === 0) {
    return apiError(429, "session_limit", "You've reached the suggestion limit for this visit. You can edit your text below.");
  }

  try {
    const result = await suggestReview({ cfg, businessName: settings.businessName, rating, text, shorter, services });
    return json(result);
  } catch (err) {
    const reason = err instanceof AiUnavailableError ? err.reason : "provider_error";
    console.error(`[ai] suggestion failed: ${reason}`); // no customer text in logs
    return apiError(503, "ai_unavailable", UNAVAILABLE);
  }
}
