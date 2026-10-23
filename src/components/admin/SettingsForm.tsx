"use client";

import { useState } from "react";
import { api } from "./api";

type Values = {
  businessName: string;
  googleReviewUrl: string;
  aiEnabled: boolean;
  aiProvider: "anthropic" | "openai" | "none";
  aiModel: string;
  notificationWebhookUrl: string;
  contactEmail: string;
  feedbackRetentionDays: number;
  analyticsRetentionDays: number;
};

export function SettingsForm({ initial, canEdit, keys }: { initial: Values; canEdit: boolean; keys: { anthropic: boolean; openai: boolean } }) {
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => errors[k] && <p className="mt-1 text-sm text-red-800">{errors[k]}</p>;
  const keyOk = v.aiProvider === "anthropic" ? keys.anthropic : v.aiProvider === "openai" ? keys.openai : true;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setMsg(null);
    const r = await api("/api/admin/settings", "PUT", {
      ...v,
      googleReviewUrl: v.googleReviewUrl.trim() || null,
      notificationWebhookUrl: v.notificationWebhookUrl.trim() || null,
      contactEmail: v.contactEmail.trim() || null,
    });
    setBusy(false);
    if (r.ok) setMsg({ ok: true, text: "Settings saved." });
    else {
      setErrors(r.fields ?? {});
      setMsg({ ok: false, text: r.message });
    }
  }

  return (
    <form method="post" action="/admin/settings" onSubmit={save} className="space-y-6">
      <fieldset disabled={!canEdit} className="space-y-6">
        {!canEdit && <p className="hint">Your account is view-only.</p>}

        <section className="rounded-2xl border border-champagne/40 bg-white p-5 space-y-4">
          <h2 className="font-serif text-2xl">Salon</h2>
          <div><label className="label" htmlFor="name">Display name</label><input id="name" className="field" required maxLength={120} value={v.businessName} onChange={(e) => set("businessName", e.target.value)} />{err("businessName")}</div>
          <div>
            <label className="label" htmlFor="gurl">Google review URL</label>
            <input id="gurl" className="field" inputMode="url" placeholder="https://search.google.com/local/writereview?placeid=…" value={v.googleReviewUrl} onChange={(e) => set("googleReviewUrl", e.target.value)} aria-describedby="gurl-help" />
            <p id="gurl-help" className="hint">Use the review link from Google Business Profile (“Ask for reviews”) or the Place ID write-review URL. Only official Google links are accepted. Shown to every customer, whatever their rating.</p>
            {err("googleReviewUrl")}
          </div>
          <div><label className="label" htmlFor="cemail">Contact email for the privacy notice <span className="font-normal text-cocoa-soft">(optional)</span></label><input id="cemail" type="email" className="field" value={v.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />{err("contactEmail")}</div>
        </section>

        <section className="rounded-2xl border border-champagne/40 bg-white p-5 space-y-4">
          <h2 className="font-serif text-2xl">AI writing assistant</h2>
          <label className="flex items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-[#8a6a35]" checked={v.aiEnabled} onChange={(e) => set("aiEnabled", e.target.checked)} /><span>Offer AI-assisted wording to customers</span></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="prov">Provider</label>
              <select id="prov" className="field" value={v.aiProvider} onChange={(e) => set("aiProvider", e.target.value as Values["aiProvider"])}><option value="anthropic">Anthropic (Claude)</option><option value="openai">OpenAI-compatible</option><option value="none">None</option></select></div>
            <div><label className="label" htmlFor="model">Model</label><input id="model" className="field" value={v.aiModel} onChange={(e) => set("aiModel", e.target.value)} />{err("aiModel")}</div>
          </div>
          <p className={`text-sm ${keyOk ? "text-green-800" : "text-red-800"}`}>
            {v.aiProvider === "none" ? "AI is off; customers write their own review text." : keyOk ? "API key found on the server." : `API key not set on the server (${v.aiProvider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY"}). Suggestions will fall back to the customer’s own text.`}
          </p>
          <p className="hint">API keys are server environment variables and are never shown or editable here.</p>
        </section>

        <section className="rounded-2xl border border-champagne/40 bg-white p-5 space-y-4">
          <h2 className="font-serif text-2xl">Notifications</h2>
          <div><label className="label" htmlFor="hook">Webhook URL <span className="font-normal text-cocoa-soft">(optional)</span></label><input id="hook" className="field" inputMode="url" placeholder="https://hooks.slack.com/…" value={v.notificationWebhookUrl} onChange={(e) => set("notificationWebhookUrl", e.target.value)} aria-describedby="hook-help" /><p id="hook-help" className="hint">Receives a short message (rating and link) for each new private feedback. Compatible with Slack, Discord, Zapier and Make. No customer text or contact details are sent.</p>{err("notificationWebhookUrl")}</div>
        </section>

        <section className="rounded-2xl border border-champagne/40 bg-white p-5 space-y-4">
          <h2 className="font-serif text-2xl">Privacy &amp; retention</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="fr">Delete resolved feedback after (days)</label><input id="fr" type="number" min={30} max={3650} className="field" value={v.feedbackRetentionDays} onChange={(e) => set("feedbackRetentionDays", Number(e.target.value))} />{err("feedbackRetentionDays")}</div>
            <div><label className="label" htmlFor="ar">Delete visit statistics after (days)</label><input id="ar" type="number" min={7} max={3650} className="field" value={v.analyticsRetentionDays} onChange={(e) => set("analyticsRetentionDays", Number(e.target.value))} />{err("analyticsRetentionDays")}</div>
          </div>
          <p className="hint">Applied by the daily <code>npm run retention:purge</code> job. Unresolved feedback is never auto-deleted.</p>
        </section>

        {canEdit && <div className="flex items-center gap-4"><button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save settings"}</button><p role="status" className={`text-sm ${msg?.ok ? "text-green-800" : "text-red-800"}`}>{msg?.text}</p></div>}
      </fieldset>
    </form>
  );
}
