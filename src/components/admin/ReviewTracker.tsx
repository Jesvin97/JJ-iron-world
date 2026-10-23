"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REPLY_TEMPLATES, NEXT_STEP } from "@/lib/review-replies";
import { api } from "./api";
import { Stars } from "./ui";

type Status = "NEW" | "REPLY_DRAFTED" | "REPLIED" | "SUSPECTED_FAKE" | "REPORTED" | "REMOVED" | "KEPT";
type Review = {
  id: string;
  reviewerName: string | null;
  rating: number;
  reviewText: string | null;
  postedAt: string;
  status: Status;
  flagReason: string | null;
  replyText: string | null;
  assignee: string | null;
  internalNotes: string | null;
};

const LABEL: Record<Status, string> = {
  NEW: "New",
  REPLY_DRAFTED: "Reply drafted",
  REPLIED: "Replied",
  SUSPECTED_FAKE: "Suspected fake",
  REPORTED: "Reported to Google",
  REMOVED: "Removed by Google",
  KEPT: "Kept by Google",
};
const OPEN: Status[] = ["NEW", "REPLY_DRAFTED", "SUSPECTED_FAKE", "REPORTED"];

function AddReview({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ reviewerName: "", rating: 1, reviewText: "", postedAt: new Date().toISOString().slice(0, 10), assignee: "" });
  const [msg, setMsg] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await api("/api/admin/reviews", "POST", { ...f, reviewerName: f.reviewerName || null, reviewText: f.reviewText || null, assignee: f.assignee || null });
    if (r.ok) onDone();
    else setMsg(r.message);
  }
  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-champagne/40 bg-white p-4 sm:grid-cols-2" aria-label="Log a Google review">
      <div><label className="label" htmlFor="rv-name">Reviewer name on Google</label><input id="rv-name" className="field" maxLength={100} value={f.reviewerName} onChange={(e) => setF({ ...f, reviewerName: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="rv-rating">Stars</label>
          <select id="rv-rating" className="field" value={f.rating} onChange={(e) => setF({ ...f, rating: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ★</option>)}</select></div>
        <div><label className="label" htmlFor="rv-date">Posted on</label><input id="rv-date" type="date" className="field" value={f.postedAt} onChange={(e) => setF({ ...f, postedAt: e.target.value })} required /></div>
      </div>
      <div className="sm:col-span-2"><label className="label" htmlFor="rv-text">Review text (paste from Google)</label><textarea id="rv-text" className="field" rows={4} maxLength={4000} value={f.reviewText} onChange={(e) => setF({ ...f, reviewText: e.target.value })} /></div>
      <div><label className="label" htmlFor="rv-assignee">Assign to</label><input id="rv-assignee" className="field" maxLength={60} value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })} /></div>
      <div className="flex items-end gap-2"><button className="btn-primary btn-sm">Add review</button></div>
      {msg && <p role="alert" className="text-sm text-red-800 sm:col-span-2">{msg}</p>}
    </form>
  );
}

function Row({ r, salon, canEdit, onChanged }: { r: Review; salon: string; canEdit: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>(r.status);
  const [reply, setReply] = useState(r.replyText ?? "");
  const [reason, setReason] = useState(r.flagReason ?? "");
  const [assignee, setAssignee] = useState(r.assignee ?? "");
  const [notes, setNotes] = useState(r.internalNotes ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    const res = await api(`/api/admin/reviews/${r.id}`, "PATCH", { status, replyText: reply || null, flagReason: reason || null, assignee: assignee || null, internalNotes: notes || null });
    setMsg(res.ok ? { ok: true, text: "Saved" } : { ok: false, text: res.message });
    if (res.ok) onChanged();
  }
  async function remove() {
    if (!confirm("Delete this entry from the tracker? (It does not touch Google.)")) return;
    const res = await api(`/api/admin/reviews/${r.id}`, "DELETE");
    if (res.ok) onChanged();
    else setMsg({ ok: false, text: res.message });
  }

  return (
    <li className="rounded-2xl border border-champagne/40 bg-white p-4">
      <button className="flex w-full flex-wrap items-center gap-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Stars n={r.rating} />
        <span className="font-semibold">{r.reviewerName ?? "Anonymous"}</span>
        <span className="text-xs text-cocoa-soft">{r.postedAt.slice(0, 10)}</span>
        <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-semibold ${OPEN.includes(r.status) ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-900"}`}>{LABEL[r.status]}</span>
      </button>
      {r.reviewText && <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm">{r.reviewText}</p>}
      {open && (
        <div className="mt-4 space-y-4 border-t border-champagne/30 pt-4">
          <p className="rounded-xl bg-sand px-4 py-3 text-sm"><strong>Next step:</strong> {NEXT_STEP[status]}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor={`st-${r.id}`}>Status</label>
              <select id={`st-${r.id}`} className="field" value={status} onChange={(e) => setStatus(e.target.value as Status)} disabled={!canEdit}>
                {(Object.keys(LABEL) as Status[]).map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
              </select></div>
            <div><label className="label" htmlFor={`as-${r.id}`}>Assigned to</label><input id={`as-${r.id}`} className="field" maxLength={60} value={assignee} onChange={(e) => setAssignee(e.target.value)} disabled={!canEdit} /></div>
          </div>
          {(status === "SUSPECTED_FAKE" || status === "REPORTED" || status === "REMOVED" || status === "KEPT") && (
            <div><label className="label" htmlFor={`fr-${r.id}`}>Why does it break Google&rsquo;s policy?</label>
              <textarea id={`fr-${r.id}`} className="field" rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} disabled={!canEdit} placeholder="e.g. Reviewer has never visited; off-topic; spam link; conflict of interest" />
              <p className="hint">Only report reviews that genuinely break Google&rsquo;s rules. A review you simply dislike is not a violation.</p></div>
          )}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2"><label className="label" htmlFor={`rp-${r.id}`}>Public reply (draft)</label>
              {canEdit && <select aria-label="Insert reply template" className="field !w-auto text-sm" value="" onChange={(e) => { const t = REPLY_TEMPLATES.find((x) => x.id === e.target.value); if (t) { setReply(t.body(salon, r.reviewerName)); if (status === "NEW") setStatus("REPLY_DRAFTED"); } }}>
                <option value="">Use a template…</option>{REPLY_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>}
            </div>
            <textarea id={`rp-${r.id}`} className="field" rows={6} maxLength={4000} value={reply} onChange={(e) => setReply(e.target.value)} disabled={!canEdit} />
            <p className="hint">Public. No private details, no blame, and never offer a discount or gift in exchange for changing or removing a review.</p>
          </div>
          <div><label className="label" htmlFor={`nt-${r.id}`}>Internal notes</label><textarea id={`nt-${r.id}`} className="field" rows={3} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} /></div>
          {canEdit && (
            <div className="flex flex-wrap gap-2"><button className="btn-primary btn-sm" onClick={save}>Save</button><button className="btn-outline btn-sm text-red-800" onClick={remove}>Delete</button></div>
          )}
          <p role="status" className={`text-sm ${msg?.ok ? "text-green-800" : "text-red-800"}`}>{msg?.text}</p>
        </div>
      )}
    </li>
  );
}

export function ReviewTracker({ initial, salon, canEdit }: { initial: Review[]; salon: string; canEdit: boolean }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const refresh = () => { setShowAdd(false); router.refresh(); };
  const shown = initial.filter((r) => (filter === "all" ? true : OPEN.includes(r.status)));
  const lowOpen = initial.filter((r) => r.rating <= 3 && OPEN.includes(r.status)).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl">Google reviews</h1>
        {canEdit && <button className="btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>{showAdd ? "Close" : "Log a review"}</button>}
      </div>
      <p className="text-sm text-cocoa-soft">
        Log reviews from your Google Business Profile here so the team can reply or, if a review truly breaks Google&rsquo;s policies, report it.
        This tool can&rsquo;t hide or remove reviews &ndash; only Google can.
      </p>
      {lowOpen > 0 && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{lowOpen} low-rated review{lowOpen === 1 ? " needs" : "s need"} attention.</p>}
      {showAdd && canEdit && <AddReview onDone={refresh} />}

      <details className="rounded-2xl border border-champagne/40 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-semibold">How to report a fake or policy-breaking review</summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-cocoa-soft">
          <li>Open your Business Profile on Google (signed in as an owner/manager), go to Reviews, tap <strong>⋮ → Report review</strong> and choose the closest reason.</li>
          <li>If it&rsquo;s still there after a few days, use Google&rsquo;s &ldquo;Report content&rdquo; / review-removal request form for the same review, with your evidence.</li>
          <li>Meanwhile, reply publicly, politely and factually. Don&rsquo;t argue and don&rsquo;t identify the customer.</li>
          <li>Never ask for a review to be changed or removed in exchange for money, discounts or gifts.</li>
        </ol>
      </details>

      <div className="flex gap-2" role="group" aria-label="Filter">
        <button className={filter === "open" ? "btn-primary btn-sm" : "btn-outline btn-sm"} onClick={() => setFilter("open")} aria-pressed={filter === "open"}>Needs action</button>
        <button className={filter === "all" ? "btn-primary btn-sm" : "btn-outline btn-sm"} onClick={() => setFilter("all")} aria-pressed={filter === "all"}>All</button>
      </div>
      <ul className="space-y-3">
        {shown.map((r) => <Row key={r.id} r={r} salon={salon} canEdit={canEdit} onChanged={refresh} />)}
        {shown.length === 0 && <li className="rounded-2xl border border-champagne/40 bg-white p-6 text-center text-cocoa-soft">Nothing here.</li>}
      </ul>
    </div>
  );
}
