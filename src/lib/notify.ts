import type { SalonSettings } from "@prisma/client";
import { appUrl } from "./env";

/**
 * Optional webhook notification (Slack/Discord/Make/Zapier compatible text payload).
 * Contains only the rating and a link to the admin area - no customer text or contact details.
 */
export async function notifyNewFeedback(settings: SalonSettings, feedback: { id: string; rating: number }) {
  const url = settings.notificationWebhookUrl;
  if (!url || !url.startsWith("https://")) return;
  const base = appUrl();
  const link = base ? `${base}/admin/feedback/${feedback.id}` : "the admin dashboard";
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `New private feedback (${feedback.rating}/5) for ${settings.businessName}: ${link}`,
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Notifications are best-effort and must never break the customer's submission.
  }
}
