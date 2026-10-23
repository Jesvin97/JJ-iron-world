import { describe, expect, it, vi, afterEach } from "vitest";
import { feedbackSchema, ratingSchema, suggestSchema } from "@/lib/validation";
import { csvCell, toCsv } from "@/lib/csv";
import { rateLimit } from "@/lib/rate-limit";
import { usableReviewUrl, validateGoogleReviewUrl } from "@/lib/google-url";
import { copyText } from "@/lib/clipboard";

describe("rating validation", () => {
  it.each([1, 2, 3, 4, 5])("accepts %i", (n) => expect(ratingSchema.safeParse(n).success).toBe(true));
  it.each([0, 6, -1, 3.5, "5", null, NaN])("rejects %s", (n) => expect(ratingSchema.safeParse(n).success).toBe(false));
  it("is enforced on the AI suggestion schema", () => {
    expect(suggestSchema.safeParse({ sessionId: "x".repeat(12), rating: 7, text: "hi" }).success).toBe(false);
  });
});

describe("feedback schema", () => {
  const base = { rating: 3, text: "The wait was longer than expected." };
  it("needs no personal details", () => {
    const r = feedbackSchema.safeParse(base);
    expect(r.success && r.data.name).toBe(null);
  });
  it("drops email and phone unless the customer consents to contact", () => {
    const r = feedbackSchema.parse({ ...base, email: "a@b.co", phone: "+91 98765 43210", contactConsent: false });
    expect(r.email).toBeNull();
    expect(r.phone).toBeNull();
  });
  it("requires a contact method when consent is given", () => {
    expect(feedbackSchema.safeParse({ ...base, contactConsent: true }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, contactConsent: true, email: "a@b.co" }).success).toBe(true);
  });
  it("rejects a malformed email and an over-long message", () => {
    expect(feedbackSchema.safeParse({ ...base, contactConsent: true, email: "nope" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, text: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("google review link configuration", () => {
  it("accepts official Google hosts over https", () => {
    expect(validateGoogleReviewUrl("https://search.google.com/local/writereview?placeid=ChIJabc").ok).toBe(true);
    expect(validateGoogleReviewUrl("https://g.page/r/abc/review").ok).toBe(true);
  });
  it("rejects http, other hosts, junk and the placeholder", () => {
    for (const u of [
      "http://search.google.com/local/writereview?placeid=x",
      "https://evil.example.com/writereview",
      "https://google.com.evil.example/x",
      "javascript:alert(1)",
      "not a url",
      "https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID",
    ]) {
      expect(validateGoogleReviewUrl(u).ok, u).toBe(false);
    }
  });
  it("usableReviewUrl hides unset/placeholder values from customers", () => {
    expect(usableReviewUrl(null)).toBeNull();
    expect(usableReviewUrl("https://search.google.com/local/writereview?placeid=YOUR_PLACE_ID")).toBeNull();
    expect(usableReviewUrl("https://g.page/r/abc/review")).toBe("https://g.page/r/abc/review");
  });
});

describe("csv", () => {
  it("quotes special characters", () => expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"'));
  it("neutralises spreadsheet formulas", () => {
    for (const v of ["=1+1", "+1", "-1", "@SUM(A1)"]) expect(csvCell(v).startsWith("'")).toBe(true);
  });
  it("builds rows", () => expect(toCsv(["a", "b"], [[1, null]])).toBe("a,b\r\n1,\r\n"));
});

describe("rate limiter", () => {
  it("blocks after the limit and recovers after the window", () => {
    const t = 1_000_000;
    expect(rateLimit("k1", 2, 1000, t).ok).toBe(true);
    expect(rateLimit("k1", 2, 1000, t + 1).ok).toBe(true);
    const blocked = rateLimit("k1", 2, 1000, t + 2);
    expect(blocked.ok).toBe(false);
    expect(rateLimit("k1", 2, 1000, t + 1001).ok).toBe(true);
  });
  it("keys are independent", () => {
    expect(rateLimit("a", 1, 1000, 5).ok).toBe(true);
    expect(rateLimit("b", 1, 1000, 5).ok).toBe(true);
  });
});

describe("copyText", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uses the async clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    expect(await copyText("hello")).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("hello");
  });
  it("reports failure instead of throwing when permission is denied and no fallback exists", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")) } });
    expect(await copyText("hello")).toBe("failed");
  });
  it("falls back to execCommand when the async API is missing", async () => {
    const ta: Record<string, unknown> = { style: {}, setAttribute() {}, select() {}, setSelectionRange() {} };
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", {
      createElement: () => ta,
      body: { appendChild: vi.fn(), removeChild: vi.fn() },
      execCommand: vi.fn().mockReturnValue(true),
    });
    expect(await copyText("hello")).toBe("copied");
    expect(ta.value).toBe("hello");
  });
});

import { reviewUrl } from "@/lib/qr";
describe("QR target URL", () => {
  it("uses the configured APP_URL, never a hardcoded domain", () => {
    expect(reviewUrl(null)).toBe("https://reviews.example.test/review");
    expect(reviewUrl("reception")).toBe("https://reviews.example.test/review?c=reception");
  });
});
