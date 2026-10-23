import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as visits } from "@/app/api/visits/route";
import { POST as suggest } from "@/app/api/ai/suggest/route";
import { buildUserMessage } from "@/lib/ai";
import { newSession, req, resetDb } from "./helpers";

beforeEach(resetDb);
const post = (body: object) => visits(req("/api/visits", { body }));

describe("POST /api/visits", () => {
  it("always records 1-3 star visits for follow-up, without personal data unless consented", async () => {
    const sessionId = await newSession();
    const res = await post({ sessionId, rating: 2, services: ["Facial"], name: "Asha", phone: "98765 43210" });
    expect(res.status).toBe(201);
    const row = await db.feedbackSubmission.findFirstOrThrow();
    expect(row).toMatchObject({ rating: 2, status: "NEW", services: ["Facial"], customerName: null, customerPhone: null, contactConsent: false });
  });

  it("keeps name and phone only with consent", async () => {
    const sessionId = await newSession();
    await post({ sessionId, rating: 3, name: "Asha", phone: "98765 43210", contactConsent: true });
    expect(await db.feedbackSubmission.findFirstOrThrow()).toMatchObject({ customerName: "Asha", customerPhone: "98765 43210", contactConsent: true });
  });

  it("does not store 4-5 star visits unless the customer opts in, and files opted-in ones as handled", async () => {
    const sessionId = await newSession();
    const none = await post({ sessionId, rating: 5, services: ["Haircut"] });
    expect(await none.json()).toEqual({ ok: true, stored: false });
    expect(await db.feedbackSubmission.count()).toBe(0);
    await post({ sessionId, rating: 5, name: "Ravi", phone: "99999 11111", contactConsent: true });
    expect(await db.feedbackSubmission.findFirstOrThrow()).toMatchObject({ rating: 5, status: "RESOLVED" });
  });

  it("validates input", async () => {
    const sessionId = await newSession();
    expect((await post({ sessionId, rating: 9 })).status).toBe(400);
    expect((await post({ sessionId, rating: 2, services: ["Not a service"] })).status).toBe(400);
    expect((await post({ sessionId, rating: 2, contactConsent: true })).status).toBe(400); // consent without phone
    expect((await post({ sessionId, rating: 2, phone: "abc", contactConsent: true })).status).toBe(400);
    expect((await post({ sessionId: "does-not-exist-123", rating: 2 })).status).toBe(404);
  });
});

describe("services in AI suggestions", () => {
  it("are listed to the model, and unknown services are rejected", async () => {
    expect(buildUserMessage({ businessName: "S", rating: 4, text: "nice", services: ["Facial", "Haircut"] })).toContain("Facial, Haircut");
    expect(buildUserMessage({ businessName: "S", rating: 4, text: "nice" })).not.toContain("Services the customer");
    const sessionId = await newSession();
    const bad = await suggest(req("/api/ai/suggest", { body: { sessionId, rating: 4, text: "Great facial today", services: ["Teeth whitening"] } }));
    expect(bad.status).toBe(400);
    const ok = await suggest(req("/api/ai/suggest", { body: { sessionId, rating: 4, text: "Great facial today and friendly staff", services: ["Facial"] } }));
    expect(ok.status).toBe(200);
  });
});
