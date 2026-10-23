import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageAdmin } from "@/lib/admin-page";
import { db } from "@/lib/db";
import { FeedbackActions } from "@/components/admin/FeedbackActions";
import { Stars, StatusBadge, fmtDate } from "@/components/admin/ui";

export const metadata = { title: "Feedback detail – Admin" };

export default async function FeedbackDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePageAdmin();
  const f = await db.feedbackSubmission.findUnique({ where: { id: (await params).id }, include: { campaign: true } });
  if (!f) notFound();
  return (
    <div className="space-y-5">
      <Link href="/admin/feedback" className="text-sm font-semibold underline">← All feedback</Link>
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-champagne/40 bg-white p-5 lg:col-span-2" aria-labelledby="fb">
          <div className="flex flex-wrap items-center gap-3"><h1 id="fb" className="font-serif text-3xl">Feedback</h1><Stars n={f.rating} /><StatusBadge status={f.status} /></div>
          <p className="text-sm text-cocoa-soft">Received {fmtDate(f.createdAt)}{f.campaign ? ` · via ${f.campaign.name}` : ""}</p>
          {/* Rendered as plain text; React escapes it. */}
          <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-ivory p-4">{f.originalText ?? "No message left."}</p>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold">Services</dt><dd>{f.services.length ? f.services.join(", ") : "—"}</dd></div>
            <div><dt className="font-semibold">Name</dt><dd>{f.customerName ?? <span className="text-cocoa-soft">Not given</span>}</dd></div>
            <div><dt className="font-semibold">May we contact them?</dt><dd>{f.contactConsent ? "Yes – consent given" : "No"}</dd></div>
            <div><dt className="font-semibold">Email</dt><dd>{f.customerEmail ? <a className="underline" href={`mailto:${f.customerEmail}`}>{f.customerEmail}</a> : "—"}</dd></div>
            <div><dt className="font-semibold">Phone</dt><dd>{f.customerPhone ?? "—"}</dd></div>
          </dl>
        </section>
        <FeedbackActions id={f.id} status={f.status} notes={f.internalNotes ?? ""} canEdit={admin.role === "ADMIN"} />
      </div>
    </div>
  );
}
