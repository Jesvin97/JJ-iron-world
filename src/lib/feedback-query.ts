import type { Prisma } from "@prisma/client";
import { db } from "./db";
import type { FeedbackFilter } from "./validation";

export const PAGE_SIZE = 20;

export function feedbackWhere(f: Partial<FeedbackFilter>): Prisma.FeedbackSubmissionWhereInput {
  const where: Prisma.FeedbackSubmissionWhereInput = {};
  if (f.rating) where.rating = f.rating;
  if (f.status) where.status = f.status;
  if (f.campaign) where.campaign = { slug: f.campaign };
  if (f.from || f.to) {
    where.createdAt = {};
    if (f.from) where.createdAt.gte = f.from;
    if (f.to) {
      // An inclusive "to" date means up to the end of that day.
      const end = new Date(f.to);
      if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0) end.setUTCDate(end.getUTCDate() + 1);
      where.createdAt.lt = end;
    }
  }
  if (f.q) {
    where.OR = [
      { originalText: { contains: f.q, mode: "insensitive" } },
      { customerName: { contains: f.q, mode: "insensitive" } },
      { internalNotes: { contains: f.q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function listFeedback(f: FeedbackFilter) {
  const where = feedbackWhere(f);
  const [total, items] = await Promise.all([
    db.feedbackSubmission.count({ where }),
    db.feedbackSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { campaign: { select: { name: true, slug: true } } },
    }),
  ]);
  return { total, page: f.page, pageSize: PAGE_SIZE, items };
}
