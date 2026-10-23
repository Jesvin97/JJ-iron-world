"use client";

import { useState } from "react";
import { REPLY_TEMPLATES, NEXT_STEP } from "@/lib/review-replies";
import { StarRating } from "../review/StarRating";
import { Stars } from "../admin/ui";

/** Self-contained walkthrough with sample data only: no database, no AI call, nothing is stored or sent. */
const SALON = "Glam’more Premium Unisex Salon & Spa";

function Customer() {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [priv, setPriv] = useState(false);
  const suggestion = text.trim()
    ? `${text.trim().replace(/\.?$/, ".")} I'd happily recommend ${SALON}.`
    : "";
  return (
    <div className="space-y-5">
      <section className="card">
        <h2 className="mb-4 text-center font-serif text-2xl">How was your experience?</h2>
        <StarRating value={rating} onChange={(n) => { setRating(n); setSent(false); }} name="Demo rating" />
      </section>
      {rating > 0 && (
        <section className="card">
          <h2 className="font-serif text-2xl">What did you enjoy?</h2>
          <textarea className="field mt-3" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label="Describe your experience" placeholder="e.g. The haircut was good and the staff were friendly." />
          {suggestion && (
            <p className="mt-3 rounded-xl bg-sand p-3 text-sm"><strong>Suggested wording (demo):</strong> {suggestion}</p>
          )}
          <a className="btn-gold mt-4 w-full" href="#demo-google" onClick={(e) => { e.preventDefault(); setSent(true); }}>
            Continue to Google Reviews <span aria-hidden="true">↗</span>
          </a>
          {sent && <p role="status" className="mt-2 text-sm text-green-800">Demo: in the real app this opens your Google review page. The link is shown for <strong>every</strong> rating.</p>}
        </section>
      )}
      {rating > 0 && rating <= 3 && (
        <section className="card text-center">
          <h2 className="font-serif text-2xl">We&rsquo;re sorry it wasn&rsquo;t perfect</h2>
          <p className="hint mt-1">Tell the team directly if you&rsquo;d like us to put things right. Your Google review stays available either way.</p>
          {priv ? <p role="status" className="mt-3 font-semibold text-green-800">Demo: private feedback would go to the admin inbox.</p> : <button className="btn-outline mt-4" onClick={() => setPriv(true)}>Tell the salon privately</button>}
        </section>
      )}
    </div>
  );
}

type St = "NEW" | "REPLY_DRAFTED" | "SUSPECTED_FAKE" | "REPORTED";
type Item = { id: number; name: string; rating: number; text: string; status: St; reason: string; reply: string };
const SAMPLE: Item[] = [
  { id: 1, name: "Meera Nair", rating: 2, text: "Waited 40 minutes past my appointment and nobody apologised.", status: "NEW", reason: "", reply: "" },
  { id: 2, name: "J. Smith", rating: 1, text: "Terrible place!! Visit www.cheap-deals.example for better.", status: "NEW", reason: "", reply: "" },
  { id: 3, name: "Ravi K", rating: 5, text: "Lovely haircut, friendly staff.", status: "NEW", reason: "", reply: "" },
];

function Team() {
  const [items, setItems] = useState(SAMPLE);
  const [err, setErr] = useState<Record<number, string>>({});
  const upd = (id: number, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  function setStatus(it: Item, status: St) {
    if ((status === "SUSPECTED_FAKE" || status === "REPORTED") && !it.reason.trim()) {
      setErr({ ...err, [it.id]: "Say which Google policy it breaks first." });
      return;
    }
    setErr({ ...err, [it.id]: "" });
    upd(it.id, { status });
  }
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.id} className="rounded-2xl border border-champagne/40 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3"><Stars n={it.rating} /><strong>{it.name}</strong><span className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">{it.status.replace("_", " ").toLowerCase()}</span></div>
          <p className="mt-2 text-sm">{it.text}</p>
          <p className="mt-2 rounded-xl bg-sand px-3 py-2 text-sm"><strong>Next step:</strong> {NEXT_STEP[it.status]}</p>
          <div className="mt-3 grid gap-2">
            <select aria-label={`Reply template for ${it.name}`} className="field text-sm" value="" onChange={(e) => { const t = REPLY_TEMPLATES.find((x) => x.id === e.target.value); if (t) upd(it.id, { reply: t.body(SALON, it.name), status: it.status === "NEW" ? "REPLY_DRAFTED" : it.status }); }}>
              <option value="">Use a reply template…</option>{REPLY_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {it.reply && <textarea aria-label={`Reply draft for ${it.name}`} className="field" rows={5} value={it.reply} onChange={(e) => upd(it.id, { reply: e.target.value })} />}
            <input aria-label={`Policy reason for ${it.name}`} className="field" placeholder="Why does it break Google’s policy? (spam, never visited…)" value={it.reason} onChange={(e) => upd(it.id, { reason: e.target.value })} />
            <div className="flex flex-wrap gap-2">
              <button className="btn-outline btn-sm" onClick={() => setStatus(it, "SUSPECTED_FAKE")}>Mark suspected fake</button>
              <button className="btn-primary btn-sm" onClick={() => setStatus(it, "REPORTED")}>Mark reported to Google</button>
            </div>
            {err[it.id] && <p role="alert" className="text-sm text-red-800">{err[it.id]}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DemoApp() {
  const [tab, setTab] = useState<"customer" | "team">("customer");
  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <header className="mb-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-dark">Interactive demo</p>
        <h1 className="mt-2 font-serif text-4xl">{SALON}</h1>
        <p className="hint mt-2">Sample data only. Nothing is saved, sent or posted.</p>
      </header>
      <div className="mb-5 flex justify-center gap-2" role="group" aria-label="Demo view">
        <button className={tab === "customer" ? "btn-primary btn-sm" : "btn-outline btn-sm"} aria-pressed={tab === "customer"} onClick={() => setTab("customer")}>Customer (scans QR)</button>
        <button className={tab === "team" ? "btn-primary btn-sm" : "btn-outline btn-sm"} aria-pressed={tab === "team"} onClick={() => setTab("team")}>Team (Google reviews)</button>
      </div>
      {tab === "customer" ? <Customer /> : <Team />}
    </main>
  );
}
