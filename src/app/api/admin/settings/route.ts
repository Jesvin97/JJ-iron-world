import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateGoogleReviewUrl } from "@/lib/google-url";
import { apiError, json, parseBody } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import { settingsSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("response" in a) return a.response;
  return json(await getSettings());
}

export async function PUT(req: Request) {
  const a = await requireAdmin(req, { write: true });
  if ("response" in a) return a.response;
  const body = await parseBody(req, settingsSchema);
  if ("response" in body) return body.response;
  const d = body.data;

  let googleReviewUrl: string | null = null;
  if (d.googleReviewUrl) {
    const v = validateGoogleReviewUrl(d.googleReviewUrl);
    if (!v.ok) return apiError(400, "validation_error", v.error, { fields: { googleReviewUrl: v.error } });
    googleReviewUrl = v.url;
  }
  if (d.notificationWebhookUrl && !d.notificationWebhookUrl.startsWith("https://")) {
    const m = "The webhook URL must use https";
    return apiError(400, "validation_error", m, { fields: { notificationWebhookUrl: m } });
  }
  await getSettings(); // ensure the singleton exists
  const saved = await db.salonSettings.update({
    where: { id: "singleton" },
    data: { ...d, googleReviewUrl },
  });
  return json(saved);
}
