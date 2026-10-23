import { db } from "./db";

export type RangeDays = 7 | 30 | 90 | 0; // 0 = all time

export function parseRange(v: string | undefined | null): RangeDays {
  const n = Number(v);
  return n === 7 || n === 90 || n === 0 ? (n as RangeDays) : 30;
}

export async function getOverview(range: RangeDays, now = new Date()) {
  const since = range ? new Date(now.getTime() - range * 86_400_000) : undefined;
  const sessionWhere = since ? { createdAt: { gte: since } } : {};

  const [scans, unique, rated, aiSessions, aiSum, copied, googleClicks, feedbackCount, byCampaign, recent, times] =
    await Promise.all([
      db.reviewSession.count({ where: sessionWhere }),
      db.reviewSession.groupBy({ by: ["anonymousSessionId"], where: sessionWhere }).then((r) => r.length),
      db.reviewSession.count({ where: { ...sessionWhere, rating: { not: null } } }),
      db.reviewSession.count({ where: { ...sessionWhere, aiGenerationCount: { gt: 0 } } }),
      db.reviewSession.aggregate({ where: sessionWhere, _sum: { aiGenerationCount: true } }),
      db.reviewSession.count({ where: { ...sessionWhere, reviewCopied: true } }),
      db.reviewSession.count({ where: { ...sessionWhere, googleLinkClicked: true } }),
      db.feedbackSubmission.count({ where: sessionWhere }),
      db.reviewSession.groupBy({
        by: ["campaignId"],
        where: sessionWhere,
        _count: { _all: true },
        _sum: { aiGenerationCount: true },
      }),
      db.feedbackSubmission.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, rating: true, originalText: true, status: true, createdAt: true },
      }),
      db.reviewSession.findMany({ where: sessionWhere, select: { createdAt: true } }),
    ]);

  // Per-campaign click counts (groupBy cannot count booleans directly).
  const campaignIds = byCampaign.map((c) => c.campaignId).filter((x): x is string => !!x);
  const [campaigns, copyBy, clickBy] = await Promise.all([
    db.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } }),
    db.reviewSession.groupBy({ by: ["campaignId"], where: { ...sessionWhere, reviewCopied: true }, _count: { _all: true } }),
    db.reviewSession.groupBy({ by: ["campaignId"], where: { ...sessionWhere, googleLinkClicked: true }, _count: { _all: true } }),
  ]);
  const nameOf = new Map(campaigns.map((c) => [c.id, c.name]));
  const copyOf = new Map(copyBy.map((c) => [c.campaignId, c._count._all]));
  const clickOf = new Map(clickBy.map((c) => [c.campaignId, c._count._all]));
  const campaignRows = byCampaign
    .map((c) => ({
      campaignId: c.campaignId,
      name: c.campaignId ? (nameOf.get(c.campaignId) ?? "Deleted campaign") : "No campaign",
      scans: c._count._all,
      copies: copyOf.get(c.campaignId) ?? 0,
      googleClicks: clickOf.get(c.campaignId) ?? 0,
    }))
    .sort((a, b) => b.scans - a.scans);

  // Daily series (UTC) covering the whole range so empty days show as zero.
  const days = range || 30;
  const series: { date: string; scans: number }[] = [];
  const index = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    index.set(key, series.length);
    series.push({ date: key, scans: 0 });
  }
  for (const t of times) {
    const i = index.get(t.createdAt.toISOString().slice(0, 10));
    if (i !== undefined) series[i].scans++;
  }

  return {
    range,
    scans,
    uniqueSessions: unique,
    rated,
    aiSessions,
    aiGenerations: aiSum._sum.aiGenerationCount ?? 0,
    copied,
    googleClicks,
    feedbackCount,
    campaigns: campaignRows,
    recentFeedback: recent,
    series,
  };
}
