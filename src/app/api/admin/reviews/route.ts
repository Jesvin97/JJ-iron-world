import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { json, parseBody, validationError } from "@/lib/http";
import { publicReviewCreateSchema, publicReviewFilterSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export async function GET(req: Request) {
  const a = await requireAdmin(req);
  if ("response" in a) return a.response;
  const parsed = publicReviewFilterSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const { status, maxRating, page } = parsed.data;
  const where = { status, rating: maxRating ? { lte: maxRating } : undefined };
  const [total, items] = await Promise.all([
    db.publicReview.count({ where }),
    db.publicReview.findMany({ where, orderBy: { postedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  return json({ total, items, page, pageSize: PAGE_SIZE });
}

export async function POST(req: Request) {
  const a = await requireAdmin(req, { write: true });
  if ("response" in a) return a.response;
  const body = await parseBody(req, publicReviewCreateSchema, 16 * 1024);
  if ("response" in body) return body.response;
  const item = await db.publicReview.create({ data: { ...body.data, reviewerName: body.data.reviewerName ?? null } });
  return json(item, 201);
}
