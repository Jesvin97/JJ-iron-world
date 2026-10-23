import { db } from "./db";
import { getSettings } from "./settings";

/** Deletes data older than the retention windows configured in Admin > Settings. */
export async function purgeExpiredData(now = new Date()) {
  const s = await getSettings();
  const day = 86_400_000;
  const sessions = await db.reviewSession.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - s.analyticsRetentionDays * day) } },
  });
  // Only resolved feedback is auto-deleted; open items are kept until a human closes them.
  const feedback = await db.feedbackSubmission.deleteMany({
    where: { status: "RESOLVED", updatedAt: { lt: new Date(now.getTime() - s.feedbackRetentionDays * day) } },
  });
  return { sessionsDeleted: sessions.count, feedbackDeleted: feedback.count };
}
