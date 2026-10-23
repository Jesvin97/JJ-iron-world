import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as createSession } from "@/app/api/sessions/route";
import { POST as sessionEvent } from "@/app/api/sessions/[id]/events/route";
import { POST as suggest } from "@/app/api/ai/suggest/route";
import { POST as submitFeedback } from "@/app/api/feedback/route";
import { GET as publicSettings } from "@/app/api/public/settings/route";
import { ctx, newSession, req, resetDb } from "./helpers";

beforeEach(resetDb);

describe("sessions & analytics events", () => {
  it("creates a session and attributes it to an active campaign", async () => {
    const camp = await db.campaign.create({ data: { slug: "reception", name: "Reception" } });
    const id = await newSession("anon-aaaaaaaaaaaaaaaa", "reception");
    expect((await db.reviewSession.findUnique({ where: { id } }))?.campaignId).toBe(camp.id);
  });
  it("ignores unknown or inactive campaigns instead of failing", async () => {
    await db.campaign.create({ data: { slug: "old", name: "Old", active: false } });
    const a = await newSession("anon-aaaaaaaaaaaaaaaa", "old");
    const b = await newSession("anon-bbbbbbbbbbbbbbbb", "nope");
    expect((await db.reviewSession.findMany({ where: { id: { in: [a, b] } } })).every((s) => s.campaignId === null)).toBe(true);
  });
  it("does not double-count reloads of the same tab", async () => {
    const a = await newSession("anon-cccccccccccccccc");
    const b = await newSession("anon-cccccccccccccccc");
    expect(a).toBe(b);
    expect(await db.reviewSession.count()).toBe(1);
  });
  it("stores no IP or other identifying data on the session", async () => {
    const id = await newSession();
    const row = await db.reviewSession.findUniqueOrThrow({ where: { id } });
    expect(Object.keys(row).sort()).toEqual(
      ["aiGenerationCount", "anonymousSessionId", "campaignId", "createdAt", "googleLinkClicked", "id", "rating", "reviewCopied"].sort(),
    );
  });
  it("records rating, copy and google click idempotently", async () => {
    const id = await newSession();
    for (const body of [{ type: "rating", rating: 4 }, { type: "copy" }, { type: "copy" }, { type: "google_click" }, { type: "google_click" }]) {
      expect((await sessionEvent(req(`/api/sessions/${id}/events`, { body }), ctx(id))).status).toBe(200);
    }
    const s = await db.reviewSession.findUniqueOrThrow({ where: { id } });
    expect(s).toMatchObject({ rating: 4, reviewCopied: true, googleLinkClicked: true });
  });
  it("records Google click regardless of rating (no gating)", async () => {
    for (const rating of [1, 3, 5]) {
      const id = await newSession(`anon-rating-${rating}-aaaaaaaa`);
      await sessionEvent(req(`/api/sessions/${id}/events`, { body: { type: "rating", rating } }), ctx(id));
      const res = await sessionEvent(req(`/api/sessions/${id}/events`, { body: { type: "google_click" } }), ctx(id));
      expect(res.status).toBe(200);
    }
    expect(await db.reviewSession.count({ where: { googleLinkClicked: true } })).toBe(3);
  });
  it("rejects invalid events, ratings and unknown sessions", async () => {
    const id = await newSession();
    expect((await sessionEvent(req(`/api/sessions/${id}/events`, { body: { type: "rating", rating: 9 } }), ctx(id))).status).toBe(400);
    expect((await sessionEvent(req(`/api/sessions/${id}/events`, { body: { type: "rating" } }), ctx(id))).status).toBe(400);
    expect((await sessionEvent(req(`/api/sessions/${id}/events`, { body: { type: "hack" } }), ctx(id))).status).toBe(400);
    expect((await sessionEvent(req(`/api/sessions/nope/events`, { body: { type: "copy" } }), ctx("nope"))).status).toBe(404);
  });
  it("validates the anonymous id", async () => {
    expect((await createSession(req("/api/sessions", { body: { anonymousSessionId: "short" } }))).status).toBe(400);
  });
});

describe("AI suggestion endpoint", () => {
  const text = "The haircut was good and staff were friendly.";
  it("returns a suggestion and counts the generation", async () => {
    const id = await newSession();
    const res = await suggest(req("/api/ai/suggest", { body: { sessionId: id, rating: 4, text } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
    expect((await db.reviewSession.findUniqueOrThrow({ where: { id } })).aiGenerationCount).toBe(1);
  });
  it("asks for more detail on thin input without counting a generation", async () => {
    const id = await newSession();
    const res = await suggest(req("/api/ai/suggest", { body: { sessionId: id, rating: 4, text: "nice" } }));
    expect((await res.json()).status).toBe("needs_more_detail");
    expect((await db.reviewSession.findUniqueOrThrow({ where: { id } })).aiGenerationCount).toBe(0);
  });
  it("enforces the per-session cap", async () => {
    const id = await newSession();
    process.env.AI_MAX_PER_SESSION = "2";
    try {
      const codes: number[] = [];
      for (let i = 0; i < 3; i++) codes.push((await suggest(req("/api/ai/suggest", { body: { sessionId: id, rating: 4, text } }))).status);
      expect(codes).toEqual([200, 200, 429]);
    } finally {
      delete process.env.AI_MAX_PER_SESSION;
    }
  });
  it("enforces the daily cap", async () => {
    const id = await newSession();
    process.env.AI_DAILY_LIMIT = "1";
    try {
      expect((await suggest(req("/api/ai/suggest", { body: { sessionId: id, rating: 4, text } }))).status).toBe(200);
      expect((await suggest(req("/api/ai/suggest", { body: { sessionId: id, rating: 4, text } }))).status).toBe(503);
    } finally {
      delete process.env.AI_DAILY_LIMIT;
    }
  });
  it("reports 503 ai_unavailable when AI is disabled so the UI can fall back", async () => {
    const id = await newSession();
    await db.salonSettings.create({ data: { id: "singleton", businessName: "S", aiEnabled: false } });
    const res = await suggest(req("/api/ai/suggest", { body: { sessionId: id, rating: 4, text } }));
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ai_unavailable");
  });
  it("reports 503 when the provider fails (not configured)", async () => {
    const id = await newSession();
    await db.salonSettings.create({ data: { id: "singleton", businessName: "S", aiProvider: "anthropic" } });
    const res = await suggest(req("/api/ai/suggest", { body: { sessionId: id, rating: 4, text } }));
    expect(res.status).toBe(503);
  });
  it("rejects invalid input and unknown sessions", async () => {
    const id = await newSession();
    expect((await suggest(req("/api/ai/suggest", { body: { sessionId: id, rating: 0, text } }))).status).toBe(400);
    expect((await suggest(req("/api/ai/suggest", { body: { sessionId: id, rating: 3, text: "x".repeat(1501) } }))).status).toBe(400);
    expect((await suggest(req("/api/ai/suggest", { body: { sessionId: "does-not-exist-123", rating: 3, text } }))).status).toBe(404);
  });
  it("rate limits per client", async () => {
    const id = await newSession();
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) codes.push((await suggest(req("/api/ai/suggest", { ip: "9.9.9.9", body: { sessionId: id, rating: 4, text: "short" } }))).status);
    expect(codes.filter((c) => c === 429).length).toBe(2);
  });
});

describe("private feedback", () => {
  const base = { rating: 2, text: "The appointment started late and nobody told me." };
  it("stores anonymous feedback for any rating", async () => {
    for (const rating of [1, 3, 5]) {
      expect((await submitFeedback(req("/api/feedback", { body: { ...base, rating } }))).status).toBe(201);
    }
    expect(await db.feedbackSubmission.count()).toBe(3);
  });
  it("returns only an acknowledgement", async () => {
    const res = await submitFeedback(req("/api/feedback", { body: base }));
    expect(await res.json()).toEqual({ ok: true });
  });
  it("keeps contact details only with explicit consent", async () => {
    await submitFeedback(req("/api/feedback", { body: { ...base, name: "Asha", email: "asha@example.test", phone: "+91 98765 43210" } }));
    await submitFeedback(req("/api/feedback", { body: { ...base, name: "Ravi", email: "ravi@example.test", contactConsent: true } }));
    const rows = await db.feedbackSubmission.findMany({ orderBy: { createdAt: "asc" } });
    expect(rows[0]).toMatchObject({ customerName: "Asha", customerEmail: null, customerPhone: null, contactConsent: false });
    expect(rows[1]).toMatchObject({ customerEmail: "ravi@example.test", contactConsent: true });
  });
  it("inherits the campaign from the session", async () => {
    const camp = await db.campaign.create({ data: { slug: "mirror", name: "Mirror" } });
    const sessionId = await newSession("anon-dddddddddddddddd", "mirror");
    await submitFeedback(req("/api/feedback", { body: { ...base, sessionId } }));
    expect((await db.feedbackSubmission.findFirstOrThrow()).campaignId).toBe(camp.id);
  });
  it.each([
    ["bad rating", { ...base, rating: 6 }],
    ["empty text", { ...base, text: "  " }],
    ["huge text", { ...base, text: "x".repeat(5000) }],
    ["bad email", { ...base, email: "x", contactConsent: true }],
    ["consent without contact", { ...base, contactConsent: true }],
  ])("rejects %s", async (_n, body) => {
    expect((await submitFeedback(req("/api/feedback", { body }))).status).toBe(400);
    expect(await db.feedbackSubmission.count()).toBe(0);
  });
  it("rejects malformed JSON, wrong content type and oversized bodies", async () => {
    expect((await submitFeedback(req("/api/feedback", { raw: "{not json" }))).status).toBe(400);
    const wrongType = new Request("https://reviews.example.test/api/feedback", { method: "POST", headers: { "content-type": "text/plain" }, body: "x" });
    expect((await submitFeedback(wrongType)).status).toBe(415);
    expect((await submitFeedback(req("/api/feedback", { raw: JSON.stringify({ ...base, text: "x".repeat(20_000) }) }))).status).toBe(413);
  });
  it("stores script content verbatim as inert text (output is escaped by React)", async () => {
    await submitFeedback(req("/api/feedback", { body: { ...base, text: "<script>alert(1)</script> late start" } }));
    expect((await db.feedbackSubmission.findFirstOrThrow()).originalText).toContain("<script>");
  });
  it("rate limits submissions per client", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await submitFeedback(req("/api/feedback", { ip: "7.7.7.7", body: base }))).status);
    expect(codes).toEqual([201, 201, 201, 201, 201, 429, 429]);
  });
});

describe("public settings", () => {
  it("exposes only customer-safe fields and hides a placeholder review URL", async () => {
    await db.salonSettings.create({
      data: { id: "singleton", businessName: "Glam’more", googleReviewUrl: "https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID", notificationWebhookUrl: "https://hooks.example/secret" },
    });
    const body = await (await publicSettings()).json();
    expect(body.googleReviewUrl).toBeNull();
    expect(Object.keys(body).sort()).toEqual(["aiEnabled", "businessName", "contactEmail", "googleReviewUrl"]);
    expect(JSON.stringify(body)).not.toContain("hooks.example");
  });
  it("returns the configured Google URL for every visitor", async () => {
    await db.salonSettings.create({ data: { id: "singleton", businessName: "G", googleReviewUrl: "https://g.page/r/abc/review" } });
    expect((await (await publicSettings()).json()).googleReviewUrl).toBe("https://g.page/r/abc/review");
  });
});
