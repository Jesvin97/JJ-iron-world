import { expect, test, type Page } from "@playwright/test";
import { ADMIN, GOOGLE_URL } from "./prepare-constants";

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("customer journey: rate → describe → AI suggestion → copy → Google link", async ({ page, context }) => {
  await context.route("https://search.google.com/**", (r) => r.fulfill({ status: 200, body: "google stub" }));
  await page.goto("/review?c=reception");
  await page.getByRole("button", { name: "Skip" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Glam");
  await page.screenshot({ path: "test-results/01-start.png", fullPage: true });

  // Keyboard-accessible stars
  await page.getByRole("radio", { name: /4 stars/ }).click();
  await expect(page.getByRole("radio", { name: /4 stars/ })).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: /5 stars/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /4 stars/ }).click();

  // Prompt chip + own words
  await page.getByRole("button", { name: "Which service did you receive?" }).click();
  await page.getByLabel("Describe your experience").fill("the haircut was good and staff were friendly");
  await page.screenshot({ path: "test-results/02-describe.png", fullPage: true });
  await page.getByRole("button", { name: "Help me write my review" }).click();

  const box = page.getByLabel("Your review text");
  await expect(box).toBeVisible();
  const generated = await box.inputValue();
  expect(generated.length).toBeGreaterThan(10);
  await box.fill(generated + " I would come again.");
  const finalText = await box.inputValue();

  await page.getByRole("button", { name: "Copy review" }).click();
  await expect(page.getByText("Review copied to your clipboard.")).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(finalText);

  const link = page.getByRole("link", { name: /Continue to Google Reviews/ });
  await expect(link).toHaveAttribute("href", GOOGLE_URL);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noopener/);
  await expect(page.getByText(/does not.*post anything/i)).toBeVisible();
  await page.screenshot({ path: "test-results/03-review.png", fullPage: true });
  const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  expect(popup.url()).toContain("search.google.com");
  await noHorizontalScroll(page);
});

test("a 1-star customer gets the same Google link and can also send private feedback", async ({ page }) => {
  await page.goto("/review");
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("radio", { name: /1 star/ }).click();
  await page.getByRole("button", { name: "I'll write it myself" }).click();
  await expect(page.getByRole("link", { name: /Continue to Google Reviews/ })).toHaveAttribute("href", GOOGLE_URL);

  // Low ratings get a prominent private-feedback prompt, in addition to (never instead of) the Google link.
  await expect(page.getByRole("heading", { name: /sorry it wasn/i })).toBeVisible();
  await page.getByRole("button", { name: "Tell the salon privately" }).click();
  await page.getByLabel("Your feedback").fill("The appointment started 30 minutes late.");
  await page.getByRole("button", { name: "Send private feedback" }).click();
  await expect(page.getByText(/private feedback has been sent/i)).toBeVisible();
  // Google link is still available after submitting feedback
  await expect(page.getByRole("link", { name: /Continue to Google Reviews/ })).toBeVisible();
});

test("consent is required to keep contact details and validation errors are shown", async ({ page }) => {
  await page.goto("/review");
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("radio", { name: /3 stars/ }).click();
  await page.getByRole("button", { name: "Tell the salon privately" }).click();
  await page.getByRole("button", { name: "Send private feedback" }).click();
  await expect(page.getByText("Please write a short message")).toBeVisible();
  await page.getByLabel("Your feedback").fill("Average visit overall.");
  await page.getByLabel(/may contact me/i).check();
  await page.getByRole("button", { name: "Send private feedback" }).click();
  await expect(page.getByText(/Add an email or phone/)).toBeVisible();
});

test("name and phone are optional up front and prefill private feedback", async ({ page }) => {
  await page.goto("/review");
  await page.getByLabel("Name").fill("Asha");
  await page.getByLabel("Phone number").fill("+91 98765 43210");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /2 stars/ }).click();
  await page.getByRole("button", { name: "Tell the salon privately" }).click();
  await expect(page.getByLabel("Name (optional)")).toHaveValue("Asha");
  await page.getByLabel(/may contact me/i).check();
  await expect(page.getByLabel("Phone")).toHaveValue("+91 98765 43210");
  // Google link is still present for a low rating
  await page.getByRole("button", { name: "I'll write it myself" }).click();
  await expect(page.getByRole("link", { name: /Continue to Google Reviews/ })).toBeVisible();
});

test("AI outage falls back to the customer's own words", async ({ page }) => {
  await page.route("**/api/ai/suggest", (r) => r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "ai_unavailable", message: "x" } }) }));
  await page.goto("/review");
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("radio", { name: /5 stars/ }).click();
  await page.getByLabel("Describe your experience").fill("Lovely facial, very relaxing.");
  await page.getByRole("button", { name: "Help me write my review" }).click();
  await expect(page.getByText(/Suggestions aren.t available right now/)).toBeVisible();
  await expect(page.getByLabel("Your review text")).toHaveValue("Lovely facial, very relaxing.");
  await expect(page.getByRole("link", { name: /Continue to Google Reviews/ })).toBeVisible();
});

test("too little detail asks for more instead of inventing content", async ({ page }) => {
  await page.goto("/review");
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("radio", { name: /5 stars/ }).click();
  await page.getByLabel("Describe your experience").fill("nice");
  await page.getByRole("button", { name: "Help me write my review" }).click();
  await expect(page.getByRole("status").filter({ hasText: /Tell us a little/ })).toBeVisible();
  await expect(page.getByLabel("Your review text")).toHaveCount(0);
});

test("clipboard failure is handled gracefully", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) } });
    document.execCommand = () => false;
  });
  await page.goto("/review");
  await page.getByRole("button", { name: "Skip" }).click();
  await page.getByRole("radio", { name: /5 stars/ }).click();
  await page.getByRole("button", { name: "I'll write it myself" }).click();
  await page.getByLabel("Your review text").fill("Great service.");
  await page.getByRole("button", { name: "Copy review" }).click();
  await expect(page.getByText(/couldn.t copy automatically/)).toBeVisible();
});

test("admin: sign in, see analytics and feedback, update status, QR + print card", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled(); // wait for hydration
  await page.getByLabel("Email").fill(ADMIN.email);
  await page.getByLabel("Password").fill("wrong-password-xx");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect email or password")).toBeVisible();
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Click-through funnel")).toBeVisible();
  await expect(page.getByText("Clicks, not posted reviews")).toBeVisible();
  await page.screenshot({ path: "test-results/04-admin-overview.png", fullPage: true });

  await page.getByRole("link", { name: "Feedback" }).click();
  await expect(page.getByText("The appointment started 30 minutes late.")).toBeVisible();
  await page.getByLabel("Search").fill("started");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await page.getByRole("link", { name: /UTC/ }).first().click();
  await page.getByLabel("Status").selectOption("REVIEWED");
  await page.getByLabel("Internal notes").fill("Apologised by phone");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Internal notes")).toHaveValue("Apologised by phone");

  await page.getByRole("link", { name: "QR codes" }).click();
  const qr = page.getByAltText("QR code for Reception desk");
  await expect(qr).toBeVisible();
  await expect.poll(() => qr.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(100);
  await page.goto("/admin/qr/print?c=reception");
  await expect(page.getByText("Scan to share your experience")).toBeVisible();
  await page.screenshot({ path: "test-results/05-print-card.png", fullPage: true });

  await page.goto("/admin/settings");
  await page.getByLabel("Google review URL").fill("https://evil.example.com/x");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText(/official Google link/).first()).toBeVisible();
});
