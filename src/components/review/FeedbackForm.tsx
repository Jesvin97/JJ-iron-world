"use client";

import { useState } from "react";
import { StarRating } from "./StarRating";

type Props = {
  rating: number;
  sessionId: string | null;
  campaign: string | null;
  initialText: string;
  initialName?: string;
  initialPhone?: string;
  contactEmail: string | null;
  onClose: () => void;
  onSent: () => void;
};

export function FeedbackForm({ rating: initialRating, sessionId, campaign, initialText, initialName = "", initialPhone = "", onClose, onSent }: Props) {
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId,
          campaign: sessionId ? undefined : campaign,
          rating,
          text,
          name: name || undefined,
          email: email || undefined,
          phone: phone || undefined,
          contactConsent: consent,
        }),
      });
      if (res.ok) return onSent();
      const data = await res.json().catch(() => ({}));
      if (data?.error?.fields) setErrors(data.error.fields);
      setFormError(
        res.status === 429 ? "You've sent several messages already. Please try again later." : (data?.error?.message ?? "Something went wrong. Please try again."),
      );
    } catch {
      setFormError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) => errors[k] && <p className="mt-1 text-sm text-red-800" id={`fb-${k}-err`}>{errors[k]}</p>;

  return (
    <form method="post" action="/review" onSubmit={submit} className="card rise text-left" aria-labelledby="fb-heading" noValidate>
      <h2 id="fb-heading" className="font-serif text-2xl">
        Private feedback
      </h2>
      <p className="hint mt-1">
        This goes only to the salon team. It is in addition to &ndash; never instead of &ndash; your public Google review, which stays available to you.
      </p>

      <div className="mt-4">
        <span className="label text-center">Your rating</span>
        <StarRating value={rating} onChange={setRating} name="Rating for private feedback" />
        {err("rating")}
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="fb-text">
          Your feedback
        </label>
        <textarea id="fb-text" className="field" rows={5} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!!errors.text} aria-describedby="fb-text-err" required />
        {err("text")}
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="fb-name">
          Name <span className="font-normal text-cocoa-soft">(optional)</span>
        </label>
        <input id="fb-name" className="field" maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <fieldset className="mt-4 rounded-xl border border-champagne/60 p-4">
        <legend className="px-1 text-sm font-semibold">Want us to get back to you? (optional)</legend>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[#8a6a35]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Yes, you may contact me about this feedback. I understand my details are used only for that purpose.</span>
        </label>
        {consent && (
          <div className="mt-3 grid gap-3">
            <div>
              <label className="label" htmlFor="fb-email">
                Email
              </label>
              <input id="fb-email" type="email" inputMode="email" autoComplete="email" className="field" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
              {err("email")}
            </div>
            <div>
              <label className="label" htmlFor="fb-phone">
                Phone
              </label>
              <input id="fb-phone" type="tel" inputMode="tel" autoComplete="tel" className="field" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} />
              {err("phone")}
            </div>
            <p className="hint">Add at least one. Without consent we don&rsquo;t keep any contact details.</p>
          </div>
        )}
      </fieldset>

      {formError && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">
          {formError}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button className="btn-primary flex-1" type="submit" disabled={busy || rating < 1}>
          {busy ? "Sending…" : "Send private feedback"}
        </button>
        <button className="btn-outline" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
      {rating < 1 && <p className="hint mt-2">Please choose a rating above.</p>}
      <p className="hint mt-3">
        See our <a className="underline" href="/privacy" target="_blank">privacy notice</a>.
      </p>
    </form>
  );
}
