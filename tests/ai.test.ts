import { afterEach, describe, expect, it, vi } from "vitest";
import { AiUnavailableError, SYSTEM_PROMPT, buildUserMessage, scrubPersonalData, suggestReview, validateModelOutput } from "@/lib/ai";

const cfg = { provider: "anthropic", model: "test-model", enabled: true };
const input = "The haircut was good and staff were friendly.";
const opts = { cfg, businessName: "Glam’more", rating: 4, text: input };

function mockAnthropic(text: string, status = 200) {
  const fn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_TIMEOUT_MS;
});

describe("scrubPersonalData / prompt", () => {
  it("removes emails, phone numbers and links", () => {
    const out = scrubPersonalData("Great! mail me at jo.doe@example.com or call +91 98765 43210, see https://x.example/a");
    expect(out).not.toMatch(/@|98765|https/);
    expect(out).toContain("Great!");
  });
  it("keeps the customer's text inside delimiters and the prompt forbids fabrication", () => {
    expect(buildUserMessage({ businessName: "S", rating: 2, text: "meh" })).toContain("<customer_input>\nmeh\n</customer_input>");
    expect(SYSTEM_PROMPT).toMatch(/Never invent services/);
    expect(SYSTEM_PROMPT).toMatch(/Never reverse the customer's sentiment/);
  });
});

describe("validateModelOutput", () => {
  const ok = JSON.stringify({ status: "ok", review: "The haircut was good and the staff were friendly.", short: "Good haircut, friendly staff." });
  it("accepts a well-formed response (even wrapped in prose/fences)", () => {
    const r = validateModelOutput("```json\n" + ok + "\n```", input);
    expect(r).toMatchObject({ status: "ok", short: "Good haircut, friendly staff." });
  });
  it("passes through a request for more detail", () => {
    const r = validateModelOutput('{"status":"needs_more_detail","message":"What did you enjoy?"}', input);
    expect(r).toEqual({ status: "needs_more_detail", message: "What did you enjoy?" });
  });
  it.each([
    ["not json", "Sure! Here is a review."],
    ["wrong shape", '{"status":"ok"}'],
    ["too long", JSON.stringify({ status: "ok", review: "a".repeat(701) })],
    ["link", JSON.stringify({ status: "ok", review: "Great, visit https://spam.example" })],
    ["email", JSON.stringify({ status: "ok", review: "Great, write to me@spam.example now" })],
    ["markup", JSON.stringify({ status: "ok", review: "<b>Great</b> haircut" })],
    ["invented number", JSON.stringify({ status: "ok", review: "I have been a client for 10 years and the haircut was good." })],
  ])("rejects %s", (_n, raw) => {
    expect(() => validateModelOutput(raw, input)).toThrow(AiUnavailableError);
  });
  it("allows numbers the customer supplied", () => {
    const r = validateModelOutput(JSON.stringify({ status: "ok", review: "I waited 20 minutes but the cut was good." }), "waited 20 minutes, cut was good");
    expect(r.status).toBe("ok");
  });
});

describe("suggestReview", () => {
  it("returns a validated suggestion and never sends contact details to the provider", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    const fetchMock = mockAnthropic(JSON.stringify({ status: "ok", review: "The haircut was good and the staff were friendly.", short: "Good haircut." }));
    const r = await suggestReview({ ...opts, text: input + " Contact me: jo@example.com 98765 43210" });
    expect(r.status).toBe("ok");
    const sent = String(fetchMock.mock.calls[0][1].body);
    expect(sent).not.toContain("jo@example.com");
    expect(sent).not.toContain("98765");
  });
  it("asks for more detail without calling the provider when input is too short", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    const fetchMock = mockAnthropic("{}");
    const r = await suggestReview({ ...opts, text: "good" });
    expect(r.status).toBe("needs_more_detail");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("throws provider_error on HTTP failure", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    mockAnthropic("x", 500);
    await expect(suggestReview(opts)).rejects.toMatchObject({ reason: "provider_error" });
  });
  it("throws invalid_output when the model misbehaves", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    mockAnthropic("I cannot help with that");
    await expect(suggestReview(opts)).rejects.toMatchObject({ reason: "invalid_output" });
  });
  it("times out", async () => {
    process.env.ANTHROPIC_API_KEY = "k";
    process.env.AI_TIMEOUT_MS = "30";
    vi.stubGlobal("fetch", (_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))));
    await expect(suggestReview(opts)).rejects.toMatchObject({ reason: "timeout" });
  });
  it("reports not_configured without an API key, and disabled when turned off", async () => {
    await expect(suggestReview(opts)).rejects.toMatchObject({ reason: "not_configured" });
    await expect(suggestReview({ ...opts, cfg: { ...cfg, enabled: false } })).rejects.toMatchObject({ reason: "disabled" });
    await expect(suggestReview({ ...opts, cfg: { ...cfg, provider: "none" } })).rejects.toMatchObject({ reason: "disabled" });
  });
});
