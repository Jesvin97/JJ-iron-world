"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

export function FeedbackActions({ id, status, notes, canEdit }: { id: string; status: string; notes: string; canEdit: boolean }) {
  const router = useRouter();
  const [st, setSt] = useState(status);
  const [note, setNote] = useState(notes);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const r = await api(`/api/admin/feedback/${id}`, "PATCH", { status: st, internalNotes: note || null });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Saved" } : { ok: false, text: r.message });
    if (r.ok) router.refresh();
  }
  async function remove() {
    if (!confirm("Permanently delete this feedback? This cannot be undone.")) return;
    const r = await api(`/api/admin/feedback/${id}`, "DELETE");
    if (r.ok) {
      router.push("/admin/feedback");
      router.refresh();
    } else setMsg({ ok: false, text: r.message });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-champagne/40 bg-white p-5" aria-labelledby="manage">
      <h2 id="manage" className="font-serif text-2xl">Manage</h2>
      {!canEdit && <p className="hint">Your account is view-only.</p>}
      <div>
        <label className="label" htmlFor="status">Status</label>
        <select id="status" className="field" value={st} onChange={(e) => setSt(e.target.value)} disabled={!canEdit}>
          <option value="NEW">New</option><option value="REVIEWED">Reviewed</option><option value="RESOLVED">Resolved</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="notes">Internal notes</label>
        <textarea id="notes" className="field" rows={5} maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} disabled={!canEdit} />
        <p className="hint">Never shown to customers.</p>
      </div>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary btn-sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
          <button className="btn-outline btn-sm text-red-800" onClick={remove}>Delete</button>
        </div>
      )}
      <p role="status" className={`text-sm ${msg?.ok ? "text-green-800" : "text-red-800"}`}>{msg?.text}</p>
    </section>
  );
}
