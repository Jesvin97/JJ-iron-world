import { beforeEach, describe, expect, it } from "vitest";
import { GET as list, POST as create } from "@/app/api/admin/reviews/route";
import { DELETE as del, GET as getOne, PATCH as patch } from "@/app/api/admin/reviews/[id]/route";
import { REPLY_TEMPLATES } from "@/lib/review-replies";
import { createAdmin, ctx, loginCookie, req, resetDb } from "./helpers";

beforeEach(resetDb);

async function adminCookie() {
  const { email, password } = await createAdmin();
  return loginCookie(email, password);
}
const base = { reviewerName: "A Stranger", rating: 1, reviewText: "Never went, terrible!", postedAt: "2026-10-20" };
async function add(cookie: string, over: object = {}) {
  const res = await create(req("/api/admin/reviews", { cookie, body: { ...base, ...over } }));
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; status: string };
}

describe("Google review tracker API", () => {
  it("requires an admin for every method", async () => {
    expect((await list(req("/api/admin/reviews"))).status).toBe(401);
    expect((await create(req("/api/admin/reviews", { body: base }))).status).toBe(401);
    expect((await getOne(req("/api/admin/reviews/x"), ctx("x"))).status).toBe(401);
    expect((await patch(req("/api/admin/reviews/x", { method: "PATCH", body: { status: "KEPT" } }), ctx("x"))).status).toBe(401);
    expect((await del(req("/api/admin/reviews/x", { method: "DELETE" }), ctx("x"))).status).toBe(401);
  });

  it("lets a view-only user read but not write", async () => {
    const admin = await adminCookie();
    const r = await add(admin);
    await createAdmin("viewer@example.test", "VIEWER", "viewer-password-12");
    const viewer = await loginCookie("viewer@example.test", "viewer-password-12");
    expect((await list(req("/api/admin/reviews", { cookie: viewer }))).status).toBe(200);
    expect((await create(req("/api/admin/reviews", { cookie: viewer, body: base }))).status).toBe(403);
    expect((await patch(req("/x", { method: "PATCH", cookie: viewer, body: { status: "KEPT" } }), ctx(r.id))).status).toBe(403);
    expect((await del(req("/x", { method: "DELETE", cookie: viewer }), ctx(r.id))).status).toBe(403);
  });

  it("logs a review as NEW and validates input", async () => {
    const cookie = await adminCookie();
    const r = await add(cookie);
    expect(r.status).toBe("NEW");
    for (const bad of [{ rating: 0 }, { rating: 6 }, { postedAt: "not-a-date" }, { postedAt: "2999-01-01" }]) {
      expect((await create(req("/api/admin/reviews", { cookie, body: { ...base, ...bad } }))).status).toBe(400);
    }
  });

  it("filters by status and by maximum rating", async () => {
    const cookie = await adminCookie();
    const low = await add(cookie, { rating: 1 });
    await add(cookie, { rating: 5 });
    await patch(req("/x", { method: "PATCH", cookie, body: { status: "REPLIED" } }), ctx(low.id));
    const byRating = await (await list(req("/api/admin/reviews?maxRating=3", { cookie }))).json();
    expect(byRating.total).toBe(1);
    const byStatus = await (await list(req("/api/admin/reviews?status=NEW", { cookie }))).json();
    expect(byStatus.total).toBe(1);
    expect(byStatus.items[0].rating).toBe(5);
    expect((await list(req("/api/admin/reviews?status=BOGUS", { cookie }))).status).toBe(400);
  });

  it("refuses to flag a review as fake or reported without a stated reason", async () => {
    const cookie = await adminCookie();
    const r = await add(cookie);
    for (const status of ["SUSPECTED_FAKE", "REPORTED"]) {
      const res = await patch(req("/x", { method: "PATCH", cookie, body: { status } }), ctx(r.id));
      expect(res.status).toBe(422);
      expect((await res.json()).error.code).toBe("reason_required");
    }
  });

  it("walks the fake-review workflow and stamps reported/resolved times", async () => {
    const cookie = await adminCookie();
    const r = await add(cookie);
    const step = async (body: object) => (await (await patch(req("/x", { method: "PATCH", cookie, body }), ctx(r.id))).json());
    let cur = await step({ status: "SUSPECTED_FAKE", flagReason: "Reviewer never visited; no matching booking", assignee: "Priya" });
    expect(cur.status).toBe("SUSPECTED_FAKE");
    expect(cur.reportedAt).toBeNull();
    cur = await step({ status: "REPORTED" });
    expect(cur.flagReason).toMatch(/never visited/); // reason carried over
    expect(cur.reportedAt).toBeTruthy();
    expect(cur.resolvedAt).toBeNull();
    const reportedAt = cur.reportedAt;
    cur = await step({ status: "REPORTED", internalNotes: "chased" });
    expect(cur.reportedAt).toBe(reportedAt); // not overwritten
    cur = await step({ status: "REMOVED" });
    expect(cur.resolvedAt).toBeTruthy();
    cur = await step({ status: "NEW" }); // reopening clears resolvedAt
    expect(cur.resolvedAt).toBeNull();
  });

  it("saves a reply draft, clears fields set to null, and rejects empty patches", async () => {
    const cookie = await adminCookie();
    const r = await add(cookie);
    const p = async (body: object) => patch(req("/x", { method: "PATCH", cookie, body }), ctx(r.id));
    expect((await (await p({ replyText: "Thanks", status: "REPLY_DRAFTED" })).json()).replyText).toBe("Thanks");
    expect((await (await p({ replyText: null })).json()).replyText).toBeNull();
    expect((await p({})).status).toBe(400);
    expect((await patch(req("/x", { method: "PATCH", cookie, body: { status: "KEPT" } }), ctx("nope"))).status).toBe(404);
  });

  it("deletes tracker entries", async () => {
    const cookie = await adminCookie();
    const r = await add(cookie);
    expect((await del(req("/x", { method: "DELETE", cookie }), ctx(r.id))).status).toBe(200);
    expect((await del(req("/x", { method: "DELETE", cookie }), ctx(r.id))).status).toBe(404);
  });
});

describe("reply templates", () => {
  it("never promise incentives and address the reviewer by first name only", () => {
    for (const t of REPLY_TEMPLATES) {
      const text = t.body("Glam’more", "Asha Kumar");
      expect(text).toContain("Hi Asha,");
      expect(text).not.toContain("Kumar");
      expect(text).not.toMatch(/discount|free|voucher|gift|refund/i);
    }
    expect(REPLY_TEMPLATES[0].body("S", null)).toContain("Hello,");
  });
});
