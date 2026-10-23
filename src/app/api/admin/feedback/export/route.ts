import { requireAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { feedbackWhere } from "@/lib/feedback-query";
import { validationError } from "@/lib/http";
import { feedbackFilterSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * CSV export honouring the active filters. Contact details are exported only for customers who
 * consented to be contacted (they are not stored otherwise).
 */
export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("response" in a) return a.response;
  const parsed = feedbackFilterSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);

  const rows = await db.feedbackSubmission.findMany({
    where: feedbackWhere(parsed.data),
    orderBy: { createdAt: "desc" },
    take: 10_000,
    include: { campaign: { select: { name: true } } },
  });
  const csv = toCsv(
    ["id", "created_at", "rating", "status", "campaign", "feedback", "name", "contact_consent", "email", "phone", "internal_notes"],
    rows.map((r) => [
      r.id,
      r.createdAt,
      r.rating,
      r.status,
      r.campaign?.name,
      r.originalText,
      r.customerName,
      r.contactConsent ? "yes" : "no",
      r.contactConsent ? r.customerEmail : "",
      r.contactConsent ? r.customerPhone : "",
      r.internalNotes,
    ]),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="glamore-feedback-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
