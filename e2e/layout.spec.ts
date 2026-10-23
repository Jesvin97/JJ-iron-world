import { expect, test } from "@playwright/test";

test("no horizontal scroll and tap targets are large enough at 360px", async ({ page }) => {
  await page.goto("/review");
  await page.getByRole("radio", { name: /5 stars/ }).click();
  await page.getByLabel("Describe your experience").fill("Wonderful blow-dry and lovely team.");
  await page.getByRole("button", { name: "Help me write my review" }).click();
  await expect(page.getByLabel("Your review text")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const link = await page.getByRole("link", { name: /continue to Google/i }).boundingBox();
  expect(link!.height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: "test-results/06-360px.png", fullPage: true });
});
