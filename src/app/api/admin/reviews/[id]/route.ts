import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, json, parseBody } from "@/lib/http";
import { publicReviewUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const a = await requireAdmin(req);
  if ("response" in a) return a.response;
  const item = await db.publicReview.findUnique({ where: { id: (await params).id } });
  return item ? json(item) : apiError(404, "not_found", "Review not found");
}

export async function PATCH(req: Request, { params }: Ctx) {
  const a = await requireAdmin(req, { write: true });
  if ("response" in a) return a.response;
  const body = await parseBody(req, publicReviewUpdateSchema, 16 * 1024);
  if ("response" in body) return body.response;
  const { status, ...rest } = body.data;
  const now = new Date();
  try {
    const current = await db.publicReview.findUnique({ where: { id: (await params).id } });
    if (!current) return apiError(404, "not_found", "Review not found");
    // Reporting needs a stated reason, so Google (and colleagues) can see why it was flagged.
    const flagReason = rest.flagReason !== undefined ? rest.flagReason : current.flagReason;
    if ((status === "SUSPECTED_FAKE" || status === "REPORTED") && !flagReason) {
      return apiError(422, "reason_required", "Say which Google policy the review breaks before flagging it", { fields: { flagReason: "Required" } });
    }
    const item = await db.publicReview.update({
      where: { id: current.id },
      data: {
        ...rest,
        status,
        reportedAt: status === "REPORTED" && !current.reportedAt ? now : undefined,
        resolvedAt: status ? (["REPLIED", "REMOVED", "KEPT"].includes(status) ? now : null) : undefined,
      },
    });
    return json(item);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return apiError(404, "not_found", "Review not found");
    throw e;
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const a = await requireAdmin(req, { write: true });
  if ("response" in a) return a.response;
  const res = await db.publicReview.deleteMany({ where: { id: (await params).id } });
  return res.count ? json({ ok: true }) : apiError(404, "not_found", "Review not found");
}
