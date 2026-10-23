"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";
import { SERVICES } from "@/lib/services";
import { StarRating } from "./StarRating";
import { FeedbackForm } from "./FeedbackForm";

type PublicSettings = { businessName: string; googleReviewUrl: string | null; aiEnabled: boolean; contactEmail: string | null };
type Step = "rate" | "describe" | "review";
type AiState = "idle" | "loading" | "ready" | "fallback";

const PROMPTS = [
  { label: "Which service did you receive?", starter: "The service I received was " },
  { label: "How was the stylist or therapist?", starter: "The stylist/therapist was " },
  { label: "How was the ambience?", starter: "The ambience was " },
  { label: "What did you appreciate most?", starter: "What I appreciated most was " },
];

function randomId() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

function anonId(): string {
  try {
    let id = sessionStorage.getItem("gm_anon");
    if (!id) sessionStorage.setItem("gm_anon", (id = randomId()));
    return id;
  } catch {
    return randomId();
  }
}

export function ReviewFlow({ settings, campaign }: { settings: PublicSettings; campaign: string | null }) {
  const { businessName, googleReviewUrl, aiEnabled } = settings;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("rate");
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [review, setReview] = useState("");
  const [shortReview, setShortReview] = useState<string | null>(null);
  const [aiState, setAiState] = useState<AiState>("idle");
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const [services, setServices] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const describeRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const reviewBox = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const sessionPromise = useRef<Promise<string | null> | null>(null);

  const ensureSession = useCallback((): Promise<string | null> => {
    if (!sessionPromise.current) {
      sessionPromise.current = fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ anonymousSessionId: anonId(), campaign }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const id = (d?.sessionId as string | undefined) ?? null;
          if (id) setSessionId(id);
          else sessionPromise.current = null; // allow a retry later
          return id;
        })
        .catch(() => {
          sessionPromise.current = null;
          return null;
        });
    }
    return sessionPromise.current;
  }, [campaign]);

  useEffect(() => {
    void ensureSession();
  }, [ensureSession]);

  const track = useCallback(
    async (type: "rating" | "copy" | "google_click", extra?: object) => {
      const id = sessionId ?? (await ensureSession());
      if (!id) return;
      try {
        await fetch(`/api/sessions/${id}/events`, {
          method: "POST",
          keepalive: true,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type, ...extra }),
        });
      } catch {
        /* analytics must never get in the customer's way */
      }
    },
    [sessionId, ensureSession],
  );

  function pickRating(n: number) {
    setRating(n);
    if (step === "rate") setStep("describe");
    void track("rating", { rating: n });
  }

  useEffect(() => {
    if (step === "describe") describeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (step === "review") {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      reviewBox.current?.focus({ preventScroll: true });
    }
  }, [step]);

  async function generate(shorter = false) {
    setAiMessage(null);
    setAiState("loading");
    const id = sessionId ?? (await ensureSession());
    try {
      if (!id) throw new Error("no session");
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: id, rating, text, shorter, services }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "needs_more_detail") {
        setAiState("idle");
        setAiMessage(data.message);
        textRef.current?.focus();
        return;
      }
      if (res.ok && data.status === "ok") {
        setReview(shorter ? data.short : data.review);
        setShortReview(shorter ? data.review : data.short);
        setAiState("ready");
        setStep("review");
        return;
      }
      if (res.status === 429) setAiMessage(data?.error?.message ?? "Suggestion limit reached.");
      throw new Error("unavailable");
    } catch {
      // Graceful fallback: the customer's own words, ready to edit.
      setReview(text.trim());
      setShortReview(null);
      setAiState("fallback");
      setStep("review");
    }
  }

  function writeMyself() {
    setReview(text.trim());
    setShortReview(null);
    setAiState("idle");
    setStep("review");
  }

  async function copyAndContinue(url: string) {
    if (!review.trim()) return;
    setContactError(null);
    if (consent && !phone.trim()) {
      setContactError("Add a phone number, or untick the follow-up box.");
      setStep("describe");
      return;
    }
    const result = await copyText(review);
    setCopy(result);
    if (result === "failed") reviewBox.current?.select();
    void track("copy");
    void track("google_click");
    const id = sessionId ?? (await ensureSession());
    if (id && rating) {
      void fetch("/api/visits", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: id, rating, services, name: name || undefined, phone: phone || undefined, contactConsent: consent }),
      }).catch(() => undefined);
    }
    // The copy is attempted first; the customer then pastes into Google and presses Post themselves.
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const ratingName = rating ? `${rating} out of 5 stars` : "";

  return (
    <div>
      <header className="mb-8 text-center rise">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-dark">Premium Unisex Salon &amp; Spa</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-cocoa sm:text-5xl">{businessName}</h1>
        <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-gold to-transparent" />
        <p className="mt-4 text-cocoa-soft">Thank you for visiting. We&rsquo;d love to hear how it went.</p>
      </header>

      <section className="card rise" aria-labelledby="rate-heading">
        <h2 id="rate-heading" className="mb-4 text-center font-serif text-2xl">
          How was your experience?
        </h2>
        <StarRating value={rating} onChange={pickRating} name="Your rating" />
      </section>

      {step !== "rate" && (
        <section ref={describeRef} className="card rise mt-5 scroll-mt-4" aria-labelledby="describe-heading">
          <h2 id="describe-heading" className="font-serif text-2xl">
            What did you enjoy about your experience at {businessName}?
          </h2>
          <p className="hint mt-1">Optional &ndash; share as much or as little as you like, in your own words.</p>

          <label htmlFor="experience" className="sr-only">
            Describe your experience
          </label>
          <textarea
            id="experience"
            ref={textRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1500}
            rows={5}
            className="field mt-4"
            placeholder="e.g. The haircut was good and the staff were friendly."
            aria-describedby="experience-help"
          />
          <div className="mt-1 flex justify-between text-xs text-cocoa-soft" id="experience-help">
            <span>We only use this to help word your review. We never add anything you didn&rsquo;t say.</span>
            <span aria-hidden="true">{text.length}/1500</span>
          </div>

          <fieldset className="mt-4">
            <legend className="label">Which services did you have? <span className="font-normal text-cocoa-soft">(optional)</span></legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SERVICES.map((svc) => {
                const on = services.includes(svc);
                return (
                  <button
                    key={svc}
                    type="button"
                    aria-pressed={on}
                    className={`rounded-full border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark ${on ? "border-gold-dark bg-gold-dark text-ivory" : "border-champagne bg-ivory text-cocoa hover:bg-sand"}`}
                    onClick={() => setServices((xs) => (on ? xs.filter((x) => x !== svc) : [...xs, svc]))}
                  >
                    {svc}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-4 rounded-xl border border-champagne/60 p-4">
            <legend className="px-1 text-sm font-semibold">Want us to follow up? (optional)</legend>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[#8a6a35]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>Yes, the salon may contact me about my visit. My name and phone are used only for that.</span>
            </label>
            {consent && (
              <div className="mt-3 grid gap-3">
                <div><label className="label" htmlFor="visit-name">Name</label><input id="visit-name" className="field" maxLength={100} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div><label className="label" htmlFor="visit-phone">Phone</label><input id="visit-phone" type="tel" inputMode="tel" className="field" maxLength={40} autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!contactError} />
                  {contactError && <p role="alert" className="mt-1 text-sm text-red-800">{contactError}</p>}</div>
              </div>
            )}
          </fieldset>

          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Writing prompts">
            {PROMPTS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="rounded-full border border-champagne bg-ivory px-3 py-2 text-sm text-cocoa hover:bg-sand focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dark"
                onClick={() => {
                  setText((t) => (t && !/\s$/.test(t) ? `${t}\n` : t) + p.starter);
                  textRef.current?.focus();
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          {aiMessage && (
            <p role="status" className="mt-4 rounded-xl bg-sand px-4 py-3 text-sm text-cocoa">
              {aiMessage}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {aiEnabled && (
              <button type="button" className="btn-primary flex-1" onClick={() => generate(false)} disabled={aiState === "loading"}>
                {aiState === "loading" ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-ivory/40 border-t-ivory" aria-hidden="true" />
                    Writing your review&hellip;
                  </>
                ) : (
                  "Help me write my review"
                )}
              </button>
            )}
            <button type="button" className={aiEnabled ? "btn-outline flex-1" : "btn-primary flex-1"} onClick={writeMyself}>
              {aiEnabled ? "I'll write it myself" : "Continue"}
            </button>
          </div>
          <p className="sr-only" aria-live="polite">
            {aiState === "loading" ? "Writing your review" : ""}
          </p>
        </section>
      )}

      {step === "review" && (
        <section ref={reviewRef} className="card rise mt-5 scroll-mt-4" aria-labelledby="review-heading">
          <h2 id="review-heading" className="font-serif text-2xl">
            Your review
          </h2>
          {aiState === "ready" && (
            <p className="hint mt-1">
              This suggestion is based only on what you wrote. Please check it reflects your honest experience &ndash; edit anything you like.
            </p>
          )}
          {aiState === "fallback" && (
            <p role="status" className="mt-2 rounded-xl bg-sand px-4 py-3 text-sm">
              Suggestions aren&rsquo;t available right now, so here are your own words. You can edit them, or write something new.
            </p>
          )}
          {aiState === "idle" && <p className="hint mt-1">Write or edit your review below &ndash; it&rsquo;s entirely your call.</p>}

          <label htmlFor="review-text" className="sr-only">
            Your review text
          </label>
          <textarea
            id="review-text"
            ref={reviewBox}
            value={review}
            onChange={(e) => {
              setReview(e.target.value);
              setCopy("idle");
            }}
            rows={7}
            maxLength={2000}
            className="field mt-4"
            placeholder="Write your review here, or just continue to Google and write it there."
          />

          {aiState === "ready" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {shortReview && shortReview !== review && (
                <button type="button" className="btn-outline btn-sm" onClick={() => setReview(shortReview)}>
                  Use shorter version
                </button>
              )}
              <button type="button" className="btn-outline btn-sm" onClick={() => generate(false)}>
                Try another suggestion
              </button>
            </div>
          )}

          <div className="mt-6">
            {googleReviewUrl ? (
              <a
                className="btn-gold w-full"
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={!review.trim()}
                onClick={(e) => {
                  e.preventDefault();
                  void copyAndContinue(googleReviewUrl);
                }}
              >
                Copy my review &amp; continue to Google
                <span aria-hidden="true">↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              <p className="rounded-xl bg-sand px-4 py-3 text-sm" role="note">
                The Google review link isn&rsquo;t available yet. Please ask our team for help.
              </p>
            )}
          </div>

          <div aria-live="polite" className="mt-3 min-h-[1.5rem] text-sm">
            {copy === "copied" && <p className="font-semibold text-green-800">Review copied to your clipboard.</p>}
            {copy === "failed" && (
              <p className="font-semibold text-red-800">
                We couldn&rsquo;t copy automatically. The text is selected &ndash; please press and hold (or Ctrl/Cmd+C) to copy it.
              </p>
            )}
          </div>

          <div className="mt-2 rounded-xl border border-champagne/60 bg-ivory p-4 text-sm">
            <p className="font-semibold">What happens next</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-cocoa-soft">
              <li>Copy your review, then open Google Reviews.</li>
              <li>Paste your text, choose your own star rating{ratingName ? ` (you chose ${ratingName} here)` : ""}, and press <strong>Post</strong>.</li>
            </ol>
            <p className="mt-2 text-cocoa-soft">
              Copying or tapping the button does <strong>not</strong> post anything &ndash; your review is only published when you press Post on Google, signed in to your own Google account.
            </p>
          </div>
        </section>
      )}

      {step !== "rate" && rating > 0 && rating <= 3 && !feedbackSent && !showFeedback && (
        <section className="card rise mt-5 text-center" aria-labelledby="sorry-heading">
          <h2 id="sorry-heading" className="font-serif text-2xl">
            We&rsquo;re sorry it wasn&rsquo;t perfect
          </h2>
          <p className="hint mt-1">
            If you&rsquo;d like us to put things right, tell the team directly. Your Google review stays available to you either way.
          </p>
          <button type="button" className="btn-outline mt-4" onClick={() => setShowFeedback(true)}>
            Tell the salon privately
          </button>
        </section>
      )}

      {step !== "rate" && (
        <section className="mt-5 text-center">
          {feedbackSent ? (
            <p role="status" className="card text-center font-semibold text-green-800">
              Thank you &ndash; your private feedback has been sent to our team.
            </p>
          ) : showFeedback ? (
            <FeedbackForm
              rating={rating}
              sessionId={sessionId}
              campaign={campaign}
              initialText=""
              contactEmail={settings.contactEmail}
              onClose={() => setShowFeedback(false)}
              onSent={() => {
                setFeedbackSent(true);
                setShowFeedback(false);
              }}
            />
          ) : (
            <button type="button" className="text-sm font-semibold text-gold-dark underline underline-offset-4 hover:text-cocoa" onClick={() => setShowFeedback(true)}>
              Want to tell us something privately? Send feedback to the salon
            </button>
          )}
        </section>
      )}

      <footer className="mt-10 text-center text-xs text-cocoa-soft">
        <a href="/privacy" className="underline underline-offset-2">
          Privacy notice
        </a>
      </footer>
    </div>
  );
}
