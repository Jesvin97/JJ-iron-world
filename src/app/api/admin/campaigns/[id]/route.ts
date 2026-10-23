import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, json, parseBody } from "@/lib/http";
import { campaignUpdateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin(req, { write: true });
  if ("response" in a) return a.response;
  const body = await parseBody(req, campaignUpdateSchema, 2048);
  if ("response" in body) return body.response;
  try {
    return json(await db.campaign.update({ where: { id: (await params).id }, data: body.data }));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return apiError(404, "not_found", "Campaign not found");
    throw e;
  }
}
