import Link from "next/link";
import { requirePageAdmin } from "@/lib/admin-page";
import { getOverview, parseRange } from "@/lib/stats";
import { StatCard, Stars, StatusBadge, fmtDate } from "@/components/admin/ui";

export const metadata = { title: "Overview – Admin" };

const RANGES = [
  { v: 7, label: "7 days" },
  { v: 30, label: "30 days" },
  { v: 90, label: "90 days" },
  { v: 0, label: "All time" },
];

export default async function Overview({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requirePageAdmin();
  const range = parseRange((await searchParams).range);
  const o = await getOverview(range);
  const pct = (n: number) => (o.scans ? Math.round((n / o.scans) * 100) : 0);
  const funnel = [
    { label: "Review page opened", n: o.scans },
    { label: "Chose a star rating", n: o.rated },
    { label: "Generated an AI suggestion", n: o.aiSessions },
    { label: "Clicked “Copy review”", n: o.copied },
    { label: "Clicked “Continue to Google Reviews”", n: o.googleClicks },
  ];
  const max = Math.max(1, ...o.series.map((d) => d.scans));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Overview</h1>
        <nav aria-label="Date range" className="flex gap-1 rounded-full bg-white p-1 shadow-sm">
          {RANGES.map((r) => (
            <Link key={r.v} href={`/admin?range=${r.v}`} aria-current={range === r.v ? "true" : undefined} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${range === r.v ? "bg-cocoa text-ivory" : "hover:bg-sand"}`}>
              {r.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="QR scans (page opens)" value={o.scans} note="Each visit to the review page" />
        <StatCard label="Unique sessions" value={o.uniqueSessions} note="Distinct browser tabs" />
        <StatCard label="Private feedback" value={o.feedbackCount} />
        <StatCard label="AI suggestions generated" value={o.aiGenerations} note={`Used in ${o.aiSessions} visit${o.aiSessions === 1 ? "" : "s"}`} />
        <StatCard label="Copy button clicks" value={o.copied} note="Visits that clicked Copy" />
        <StatCard label="Google link clicks" value={o.googleClicks} note="Clicks, not posted reviews" />
      </div>

      <section className="rounded-2xl border border-champagne/40 bg-white p-5" aria-labelledby="funnel">
        <h2 id="funnel" className="font-serif text-2xl">Click-through funnel</h2>
        <p className="hint">Percentages are relative to page opens. “Google link clicks” are clicks only &ndash; we cannot see whether a review was actually posted on Google.</p>
        <ul className="mt-4 space-y-3">
          {funnel.map((f) => (
            <li key={f.label}>
              <div className="flex justify-between text-sm"><span>{f.label}</span><span className="font-semibold">{f.n} <span className="font-normal text-cocoa-soft">({pct(f.n)}%)</span></span></div>
              <div className="mt-1 h-3 rounded-full bg-sand" role="img" aria-label={`${f.label}: ${pct(f.n)} percent`}>
                <div className="h-3 rounded-full bg-gradient-to-r from-champagne to-gold-dark" style={{ width: `${pct(f.n)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-champagne/40 bg-white p-5" aria-labelledby="trend">
        <h2 id="trend" className="font-serif text-2xl">Daily page opens</h2>
        <div className="mt-4 flex h-32 items-end gap-px" role="img" aria-label={`Bar chart of daily page opens over the last ${o.series.length} days`}>
          {o.series.map((d) => (
            <div key={d.date} title={`${d.date}: ${d.scans}`} className="flex-1 rounded-t bg-gold-dark/80" style={{ height: `${Math.max(2, (d.scans / max) * 100)}%`, opacity: d.scans ? 1 : 0.2 }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-cocoa-soft"><span>{o.series[0]?.date}</span><span>{o.series.at(-1)?.date}</span></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-champagne/40 bg-white p-5" aria-labelledby="camp">
          <h2 id="camp" className="font-serif text-2xl">By QR location</h2>
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-cocoa-soft"><tr><th className="py-2 pr-3 font-semibold">Location</th><th className="pr-3 font-semibold">Scans</th><th className="pr-3 font-semibold">Copies</th><th className="font-semibold">Google clicks</th></tr></thead>
              <tbody>
                {o.campaigns.map((c) => (
                  <tr key={c.campaignId ?? "none"} className="border-t border-champagne/30"><td className="py-2 pr-3">{c.name}</td><td className="pr-3">{c.scans}</td><td className="pr-3">{c.copies}</td><td>{c.googleClicks}</td></tr>
                ))}
                {o.campaigns.length === 0 && <tr><td colSpan={4} className="py-4 text-cocoa-soft">No scans in this period.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-champagne/40 bg-white p-5" aria-labelledby="recent">
          <div className="flex items-baseline justify-between"><h2 id="recent" className="font-serif text-2xl">Recent feedback</h2><Link href="/admin/feedback" className="text-sm font-semibold underline">View all</Link></div>
          <ul className="mt-3 divide-y divide-champagne/30">
            {o.recentFeedback.map((f) => (
              <li key={f.id}>
                <Link href={`/admin/feedback/${f.id}`} className="block py-3 hover:bg-ivory">
                  <div className="flex items-center justify-between gap-2"><Stars n={f.rating} /><StatusBadge status={f.status} /></div>
                  <p className="mt-1 line-clamp-2 text-sm">{f.originalText}</p>
                  <p className="text-xs text-cocoa-soft">{fmtDate(f.createdAt)}</p>
                </Link>
              </li>
            ))}
            {o.recentFeedback.length === 0 && <li className="py-4 text-sm text-cocoa-soft">No feedback yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
