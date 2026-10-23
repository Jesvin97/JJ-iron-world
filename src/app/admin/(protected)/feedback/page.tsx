import Link from "next/link";
import { requirePageAdmin } from "@/lib/admin-page";
import { db } from "@/lib/db";
import { listFeedback } from "@/lib/feedback-query";
import { feedbackFilterSchema } from "@/lib/validation";
import { Stars, StatusBadge, fmtDate } from "@/components/admin/ui";

export const metadata = { title: "Feedback – Admin" };

type SP = Record<string, string | undefined>;

export default async function FeedbackList({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePageAdmin();
  const sp = await searchParams;
  // Drop empty form fields so they don't fail validation.
  const clean = Object.fromEntries(Object.entries(sp).filter(([, v]) => v));
  const parsed = feedbackFilterSchema.safeParse(clean);
  const filter = parsed.success ? parsed.data : feedbackFilterSchema.parse({});
  const [{ total, items, page, pageSize }, campaigns] = await Promise.all([listFeedback(filter), db.campaign.findMany({ orderBy: { name: "asc" } })]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const qs = (over: Record<string, string | number>) => {
    const p = new URLSearchParams(Object.entries(clean) as [string, string][]);
    for (const [k, v] of Object.entries(over)) p.set(k, String(v));
    return p.toString();
  };
  const exportQs = new URLSearchParams(Object.entries(clean).filter(([k]) => k !== "page") as [string, string][]).toString();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Private feedback</h1>
        <a className="btn-outline btn-sm" href={`/api/admin/feedback/export?${exportQs}`}>Export CSV</a>
      </div>
      {!parsed.success && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">Some filters were invalid and were ignored.</p>}

      <form method="get" className="grid gap-3 rounded-2xl border border-champagne/40 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6" role="search" aria-label="Filter feedback">
        <div className="lg:col-span-2"><label className="label" htmlFor="q">Search</label><input id="q" name="q" className="field" defaultValue={sp.q} placeholder="Text, name or notes" /></div>
        <div><label className="label" htmlFor="rating">Rating</label>
          <select id="rating" name="rating" className="field" defaultValue={sp.rating ?? ""}><option value="">Any</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ★</option>)}</select></div>
        <div><label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="field" defaultValue={sp.status ?? ""}><option value="">Any</option><option value="NEW">New</option><option value="REVIEWED">Reviewed</option><option value="RESOLVED">Resolved</option></select></div>
        <div><label className="label" htmlFor="from">From</label><input id="from" type="date" name="from" className="field" defaultValue={sp.from} /></div>
        <div><label className="label" htmlFor="to">To</label><input id="to" type="date" name="to" className="field" defaultValue={sp.to} /></div>
        <div className="sm:col-span-2 lg:col-span-2"><label className="label" htmlFor="campaign">QR location</label>
          <select id="campaign" name="campaign" className="field" defaultValue={sp.campaign ?? ""}><option value="">Any</option>{campaigns.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4"><button className="btn-primary btn-sm">Apply filters</button><Link href="/admin/feedback" className="btn-outline btn-sm">Reset</Link></div>
      </form>

      <p className="text-sm text-cocoa-soft" aria-live="polite">{total} submission{total === 1 ? "" : "s"}</p>
      <div className="overflow-x-auto rounded-2xl border border-champagne/40 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-sand/60 text-cocoa-soft"><tr><th className="p-3 font-semibold">Received</th><th className="font-semibold">Rating</th><th className="font-semibold">Feedback</th><th className="font-semibold">Location</th><th className="font-semibold">Status</th></tr></thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id} className="border-t border-champagne/30 align-top hover:bg-ivory">
                <td className="whitespace-nowrap p-3"><Link className="font-semibold underline" href={`/admin/feedback/${f.id}`}>{fmtDate(f.createdAt)}</Link></td>
                <td><Stars n={f.rating} /></td>
                <td className="max-w-md py-3 pr-3"><p className="line-clamp-2">{f.originalText ?? <span className="text-cocoa-soft">No message{f.services.length ? ` · ${f.services.join(", ")}` : ""}</span>}</p>{f.customerName && <p className="text-xs text-cocoa-soft">— {f.customerName}</p>}</td>
                <td className="pr-3">{f.campaign?.name ?? "—"}</td>
                <td><StatusBadge status={f.status} /></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-cocoa-soft">No feedback matches these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link className="btn-outline btn-sm" href={`/admin/feedback?${qs({ page: page - 1 })}`}>← Previous</Link> : <span />}
          <span>Page {page} of {pages}</span>
          {page < pages ? <Link className="btn-outline btn-sm" href={`/admin/feedback?${qs({ page: page + 1 })}`}>Next →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
