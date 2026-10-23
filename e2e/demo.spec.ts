import { expect, test } from "@playwright/test";

test("demo: low rating shows the private card and the Google link; fake flag needs a reason", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("radio", { name: /1 star/ }).click();
  await expect(page.getByRole("link", { name: /Continue to Google Reviews/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tell the salon privately" })).toBeVisible();
  await page.getByRole("radio", { name: /5 stars/ }).click();
  await expect(page.getByRole("link", { name: /Continue to Google Reviews/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Tell the salon privately" })).toHaveCount(0);

  await page.getByRole("button", { name: /Team/ }).click();
  const second = page.locator("li").nth(1);
  await second.getByRole("button", { name: "Mark reported to Google" }).click();
  await expect(second.getByRole("alert")).toContainText("Say which Google policy");
  await second.getByLabel(/Policy reason/).fill("Spam link, not a customer");
  await second.getByRole("button", { name: "Mark reported to Google" }).click();
  await expect(second).toContainText("reported");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
