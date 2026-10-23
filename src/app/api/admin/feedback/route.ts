import { requireAdmin } from "@/lib/auth";
import { listFeedback } from "@/lib/feedback-query";
import { apiError, json, validationError } from "@/lib/http";
import { feedbackFilterSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("response" in a) return a.response;
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = feedbackFilterSchema.safeParse(params);
  if (!parsed.success) return validationError(parsed.error);
  return json(await listFeedback(parsed.data));
}

export function POST() {
  return apiError(405, "method_not_allowed", "Method not allowed");
}
