import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as logout } from "@/app/api/admin/logout/route";
import { GET as listFeedback } from "@/app/api/admin/feedback/route";
import { GET as getFeedback, PATCH as patchFeedback, DELETE as deleteFeedback } from "@/app/api/admin/feedback/[id]/route";
import { GET as exportCsv } from "@/app/api/admin/feedback/export/route";
import { GET as getSettings, PUT as putSettings } from "@/app/api/admin/settings/route";
import { GET as listCampaigns, POST as addCampaign } from "@/app/api/admin/campaigns/route";
import { PATCH as patchCampaign } from "@/app/api/admin/campaigns/[id]/route";
import { GET as stats } from "@/app/api/admin/stats/route";
import { GET as qr } from "@/app/api/admin/qr/route";
import { createAdmin, ctx, loginCookie, req, resetDb } from "./helpers";

beforeEach(resetDb);

const settingsBody = {
  businessName: "Glam’more Premium Unisex Salon & Spa",
  googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJreal",
  aiEnabled: true,
  aiProvider: "anthropic",
  aiModel: "claude-haiku-5-5",
  notificationWebhookUrl: null,
  contactEmail: "",
  feedbackRetentionDays: 365,
  analyticsRetentionDays: 180,
};

describe("authentication", () => {
  it("logs in with valid credentials and sets a hardened cookie", async () => {
    const { email, password } = await createAdmin();
    const res = await login(req("/api/admin/login", { body: { email: email.toUpperCase(), password } }));
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=strict/i);
  });
  it("rejects a wrong password and an unknown user with the same message", async () => {
    const { email } = await createAdmin();
    const a = await login(req("/api/admin/login", { body: { email, password: "wrong-password-123" } }));
    const b = await login(req("/api/admin/login", { body: { email: "nobody@example.test", password: "wrong-password-123" } }));
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect((await a.json()).error.message).toBe((await b.json()).error.message);
    expect(a.headers.get("set-cookie")).toBeNull();
  });
  it("rate limits repeated login attempts", async () => {
    const { email } = await createAdmin();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await login(req("/api/admin/login", { ip: "5.5.5.5", body: { email, password: "bad-password-1234" } }))).status);
    expect(codes.slice(0, 5).every((c) => c === 401)).toBe(true);
    expect(codes.slice(5)).toEqual([429, 429]);
  });
  it("blocks cross-origin login attempts", async () => {
    const { email, password } = await createAdmin();
    const res = await login(req("/api/admin/login", { body: { email, password }, headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
  });
  it("logout clears the cookie", async () => {
    const res = await logout(req("/api/admin/logout", { method: "POST" }));
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });
});

describe("authorization on every admin endpoint", () => {
  it("returns 401 without a session or with a forged one", async () => {
    const id = "abc";
    const cases: Promise<Response>[] = [
      listFeedback(req("/api/admin/feedback")),
      getFeedback(req(`/api/admin/feedback/${id}`), ctx(id)),
      patchFeedback(req(`/api/admin/feedback/${id}`, { method: "PATCH", body: { status: "RESOLVED" } }), ctx(id)),
      deleteFeedback(req(`/api/admin/feedback/${id}`, { method: "DELETE" }), ctx(id)),
      exportCsv(req("/api/admin/feedback/export")),
      getSettings(req("/api/admin/settings")),
      putSettings(req("/api/admin/settings", { method: "PUT", body: settingsBody })),
      listCampaigns(req("/api/admin/campaigns")),
      addCampaign(req("/api/admin/campaigns", { body: { name: "x", slug: "x" } })),
      patchCampaign(req(`/api/admin/campaigns/${id}`, { method: "PATCH", body: { active: false } }), ctx(id)),
      stats(req("/api/admin/stats")),
      qr(req("/api/admin/qr")),
      listFeedback(req("/api/admin/feedback", { cookie: "glamore_admin=forged.token.value" })),
    ];
    for (const r of await Promise.all(cases)) expect(r.status).toBe(401);
  });
  it("a deleted admin loses access immediately even with a valid token", async () => {
    const { email, password } = await createAdmin();
    const cookie = await loginCookie(email, password);
    expect((await listFeedback(req("/api/admin/feedback", { cookie }))).status).toBe(200);
    await db.adminUser.deleteMany();
    expect((await listFeedback(req("/api/admin/feedback", { cookie }))).status).toBe(401);
  });
  it("VIEWER can read but not modify", async () => {
    const { email, password } = await createAdmin("viewer@example.test", "VIEWER");
    const cookie = await loginCookie(email, password);
    const fb = await db.feedbackSubmission.create({ data: { rating: 3, originalText: "ok" } });
    expect((await listFeedback(req("/api/admin/feedback", { cookie }))).status).toBe(200);
    expect((await patchFeedback(req(`/api/admin/feedback/${fb.id}`, { method: "PATCH", cookie, body: { status: "RESOLVED" } }), ctx(fb.id))).status).toBe(403);
    expect((await deleteFeedback(req(`/api/admin/feedback/${fb.id}`, { method: "DELETE", cookie }), ctx(fb.id))).status).toBe(403);
    expect((await putSettings(req("/api/admin/settings", { method: "PUT", cookie, body: settingsBody }))).status).toBe(403);
    expect((await addCampaign(req("/api/admin/campaigns", { cookie, body: { name: "x", slug: "x" } }))).status).toBe(403);
    expect((await db.feedbackSubmission.findUniqueOrThrow({ where: { id: fb.id } })).status).toBe("NEW");
  });
  it("blocks cross-origin writes from an authenticated browser (CSRF)", async () => {
    const { email, password } = await createAdmin();
    const cookie = await loginCookie(email, password);
    const fb = await db.feedbackSubmission.create({ data: { rating: 3, originalText: "ok" } });
    const res = await patchFeedback(req(`/api/admin/feedback/${fb.id}`, { method: "PATCH", cookie, headers: { origin: "https://evil.example" }, body: { status: "RESOLVED" } }), ctx(fb.id));
    expect(res.status).toBe(403);
  });
});

describe("feedback management", () => {
  async function seed() {
    const camp = await db.campaign.create({ data: { slug: "checkout", name: "Checkout" } });
    const mk = (rating: number, text: string, createdAt: string, extra = {}) =>
      db.feedbackSubmission.create({ data: { rating, originalText: text, createdAt: new Date(createdAt), ...extra } });
    await mk(1, "Waited far too long for the colour", "2026-03-01T10:00:00Z");
    await mk(3, "Average massage, nice towels", "2026-03-10T10:00:00Z", { campaignId: camp.id, status: "REVIEWED" });
    await mk(5, "Loved the facial", "2026-03-20T10:00:00Z", { customerName: "Meera" });
    await mk(5, "Great haircut", "2026-04-02T10:00:00Z", { status: "RESOLVED", internalNotes: "called back" });
  }
  async function asAdmin() {
    const { email, password } = await createAdmin();
    return loginCookie(email, password);
  }
  const list = async (cookie: string, qs = "") => (await (await listFeedback(req(`/api/admin/feedback${qs}`, { cookie }))).json()) as { total: number; items: { originalText: string }[] };

  it("lists newest first and paginates", async () => {
    await seed();
    const body = await list(await asAdmin());
    expect(body.total).toBe(4);
    expect(body.items[0].originalText).toBe("Great haircut");
  });
  it("filters by rating, status, date range, campaign and text", async () => {
    await seed();
    const c = await asAdmin();
    expect((await list(c, "?rating=5")).total).toBe(2);
    expect((await list(c, "?status=RESOLVED")).total).toBe(1);
    expect((await list(c, "?from=2026-03-05&to=2026-03-25")).total).toBe(2);
    expect((await list(c, "?to=2026-03-10")).total).toBe(2); // inclusive end date
    expect((await list(c, "?campaign=checkout")).total).toBe(1);
    expect((await list(c, "?q=FACIAL")).total).toBe(1); // case-insensitive search
    expect((await list(c, "?q=called back")).total).toBe(1); // searches internal notes
    expect((await list(c, "?rating=5&status=NEW")).total).toBe(1);
  });
  it("rejects invalid filters", async () => {
    const c = await asAdmin();
    expect((await listFeedback(req("/api/admin/feedback?rating=9", { cookie: c }))).status).toBe(400);
    expect((await listFeedback(req("/api/admin/feedback?from=notadate", { cookie: c }))).status).toBe(400);
  });
  it("updates status and internal notes", async () => {
    const c = await asAdmin();
    const fb = await db.feedbackSubmission.create({ data: { rating: 2, originalText: "slow" } });
    const res = await patchFeedback(req(`/api/admin/feedback/${fb.id}`, { method: "PATCH", cookie: c, body: { status: "REVIEWED", internalNotes: "Spoke to manager" } }), ctx(fb.id));
    expect(res.status).toBe(200);
    expect(await db.feedbackSubmission.findUniqueOrThrow({ where: { id: fb.id } })).toMatchObject({ status: "REVIEWED", internalNotes: "Spoke to manager" });
    const res2 = await patchFeedback(req(`/api/admin/feedback/${fb.id}`, { method: "PATCH", cookie: c, body: { status: "RESOLVED" } }), ctx(fb.id));
    expect((await res2.json()).internalNotes).toBe("Spoke to manager"); // notes untouched
  });
  it("validates updates and 404s on unknown ids", async () => {
    const c = await asAdmin();
    expect((await patchFeedback(req("/api/admin/feedback/x", { method: "PATCH", cookie: c, body: { status: "DONE" } }), ctx("x"))).status).toBe(400);
    expect((await patchFeedback(req("/api/admin/feedback/x", { method: "PATCH", cookie: c, body: {} }), ctx("x"))).status).toBe(400);
    expect((await patchFeedback(req("/api/admin/feedback/x", { method: "PATCH", cookie: c, body: { status: "NEW" } }), ctx("x"))).status).toBe(404);
  });
  it("deletes a submission", async () => {
    const c = await asAdmin();
    const fb = await db.feedbackSubmission.create({ data: { rating: 2, originalText: "x" } });
    expect((await deleteFeedback(req("/x", { method: "DELETE", cookie: c }), ctx(fb.id))).status).toBe(200);
    expect(await db.feedbackSubmission.count()).toBe(0);
    expect((await deleteFeedback(req("/x", { method: "DELETE", cookie: c }), ctx(fb.id))).status).toBe(404);
  });
  it("exports CSV honouring filters, protecting against formula injection and omitting non-consented contact data", async () => {
    const c = await asAdmin();
    await db.feedbackSubmission.createMany({
      data: [
        { rating: 5, originalText: "=HYPERLINK(\"http://x\")", customerEmail: "keep@example.test", contactConsent: true },
        { rating: 5, originalText: "legacy row", customerEmail: "hidden@example.test", contactConsent: false },
        { rating: 1, originalText: "other rating" },
      ],
    });
    const res = await exportCsv(req("/api/admin/feedback/export?rating=5", { cookie: c }));
    const text = await res.text();
    expect(res.headers.get("content-type")).toMatch(/text\/csv/);
    expect(res.headers.get("content-disposition")).toMatch(/attachment/);
    expect(text).toContain("keep@example.test");
    expect(text).not.toContain("hidden@example.test");
    expect(text).not.toContain("other rating");
    expect(text).toContain("\"'=HYPERLINK");
  });
});

describe("settings", () => {
  it("saves valid settings and exposes them to the public endpoint", async () => {
    const { email, password } = await createAdmin();
    const c = await loginCookie(email, password);
    const res = await putSettings(req("/api/admin/settings", { method: "PUT", cookie: c, body: settingsBody }));
    expect(res.status).toBe(200);
    expect((await db.salonSettings.findUniqueOrThrow({ where: { id: "singleton" } })).googleReviewUrl).toBe(settingsBody.googleReviewUrl);
  });
  it.each([
    ["non-Google review URL", { googleReviewUrl: "https://evil.example/review" }],
    ["placeholder review URL", { googleReviewUrl: "https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID" }],
    ["http webhook", { notificationWebhookUrl: "http://hooks.example/x" }],
    ["retention too low", { feedbackRetentionDays: 1 }],
    ["blank name", { businessName: " " }],
    ["unknown provider", { aiProvider: "skynet" }],
  ])("rejects %s", async (_n, patch) => {
    const { email, password } = await createAdmin();
    const c = await loginCookie(email, password);
    const res = await putSettings(req("/api/admin/settings", { method: "PUT", cookie: c, body: { ...settingsBody, ...patch } }));
    expect(res.status).toBe(400);
  });
});

describe("campaigns, QR and analytics accuracy", () => {
  it("creates, de-duplicates and deactivates campaigns", async () => {
    const { email, password } = await createAdmin();
    const c = await loginCookie(email, password);
    const created = await addCampaign(req("/api/admin/campaigns", { cookie: c, body: { name: "Reception", slug: "reception" } }));
    expect(created.status).toBe(201);
    expect((await addCampaign(req("/api/admin/campaigns", { cookie: c, body: { name: "Again", slug: "reception" } }))).status).toBe(409);
    expect((await addCampaign(req("/api/admin/campaigns", { cookie: c, body: { name: "Bad", slug: "Bad Slug!" } }))).status).toBe(400);
    const { id } = await created.json();
    expect((await patchCampaign(req(`/api/admin/campaigns/${id}`, { method: "PATCH", cookie: c, body: { active: false } }), ctx(id))).status).toBe(200);
  });
  it("generates PNG and SVG QR codes that target the configured domain", async () => {
    const { email, password } = await createAdmin();
    const c = await loginCookie(email, password);
    const png = await qr(req("/api/admin/qr?campaign=reception&format=png&download=1", { cookie: c }));
    expect(png.headers.get("content-type")).toBe("image/png");
    expect(png.headers.get("content-disposition")).toContain("glamore-qr-reception.png");
    expect(new Uint8Array(await png.arrayBuffer()).slice(0, 4)).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
    const svg = await qr(req("/api/admin/qr?format=svg", { cookie: c }));
    expect(await svg.text()).toContain("<svg");
    expect((await qr(req("/api/admin/qr?campaign=BAD%20slug", { cookie: c }))).status).toBe(400);
  });
  it("reports funnel numbers that match the underlying events", async () => {
    const { email, password } = await createAdmin();
    const c = await loginCookie(email, password);
    const camp = await db.campaign.create({ data: { slug: "mirror", name: "Mirror" } });
    const mk = (anon: string, extra: object) => db.reviewSession.create({ data: { anonymousSessionId: anon, ...extra } });
    await mk("anon-aaaaaaaaaaaaaaaa", { campaignId: camp.id, rating: 5, aiGenerationCount: 2, reviewCopied: true, googleLinkClicked: true });
    await mk("anon-aaaaaaaaaaaaaaaa", { rating: 4, aiGenerationCount: 1, reviewCopied: true }); // same visitor, later visit
    await mk("anon-bbbbbbbbbbbbbbbb", { campaignId: camp.id, rating: 2 });
    await mk("anon-cccccccccccccccc", {});
    await mk("anon-old-dddddddddddddd", { createdAt: new Date(Date.now() - 60 * 86_400_000) });
    await db.feedbackSubmission.create({ data: { rating: 2, originalText: "x" } });

    const s = await (await stats(req("/api/admin/stats?range=30", { cookie: c }))).json();
    expect(s).toMatchObject({ scans: 4, uniqueSessions: 3, rated: 3, aiSessions: 2, aiGenerations: 3, copied: 2, googleClicks: 1, feedbackCount: 1 });
    expect(s.campaigns.find((x: { name: string }) => x.name === "Mirror")).toMatchObject({ scans: 2, googleClicks: 1, copies: 1 });
    expect(s.series).toHaveLength(30);
    expect(s.series.reduce((n: number, d: { scans: number }) => n + d.scans, 0)).toBe(4);
    const all = await (await stats(req("/api/admin/stats?range=0", { cookie: c }))).json();
    expect(all.scans).toBe(5);
  });
});
