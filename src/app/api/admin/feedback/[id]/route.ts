import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, json, parseBody } from "@/lib/http";
import { feedbackUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const a = await requireAdmin(req);
  if ("response" in a) return a.response;
  const item = await db.feedbackSubmission.findUnique({ where: { id: (await params).id }, include: { campaign: true } });
  return item ? json(item) : apiError(404, "not_found", "Feedback not found");
}

export async function PATCH(req: Request, { params }: Ctx) {
  const a = await requireAdmin(req, { write: true });
  if ("response" in a) return a.response;
  const body = await parseBody(req, feedbackUpdateSchema, 8 * 1024);
  if ("response" in body) return body.response;
  try {
    const item = await db.feedbackSubmission.update({
      where: { id: (await params).id },
      data: { status: body.data.status, internalNotes: body.data.internalNotes },
    });
    return json(item);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return apiError(404, "not_found", "Feedback not found");
    throw e;
  }
}

/** Permanent deletion, e.g. to honour a customer's erasure request. */
export async function DELETE(req: Request, { params }: Ctx) {
  const a = await requireAdmin(req, { write: true });
  if ("response" in a) return a.response;
  const res = await db.feedbackSubmission.deleteMany({ where: { id: (await params).id } });
  return res.count ? json({ ok: true }) : apiError(404, "not_found", "Feedback not found");
}
