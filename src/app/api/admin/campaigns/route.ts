import { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiError, json, parseBody } from "@/lib/http";
import { campaignCreateSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("response" in a) return a.response;
  return json(await db.campaign.findMany({ orderBy: { createdAt: "asc" } }));
}

export async function POST(req: Request) {
  const a = await requireAdmin(req, { write: true });
  if ("response" in a) return a.response;
  const body = await parseBody(req, campaignCreateSchema, 2048);
  if ("response" in body) return body.response;
  try {
    return json(await db.campaign.create({ data: body.data }), 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return apiError(409, "conflict", "A campaign with that identifier already exists", { fields: { slug: "Already in use" } });
    }
    throw e;
  }
}
