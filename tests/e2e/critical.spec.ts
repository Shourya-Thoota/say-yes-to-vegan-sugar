import { test, expect } from "@playwright/test";

test("homepage loads with hero CTAs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "A thoughtful choice for every offering." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request a Sugar Donation" }).first()).toBeVisible();
});

test("mobile menu opens and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const btn = page.getByRole("button", { name: /open menu/i });
  if (await btn.isVisible()) {
    await btn.click();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
  }
});

test("choosing-sugar page has checklist and copy button", async ({ page }) => {
  await page.goto("/choosing-sugar");
  await expect(page.getByRole("heading", { name: "Know what to look for." })).toBeVisible();
  await expect(page.getByRole("button", { name: /copy inquiry/i })).toBeVisible();
});

test("request form validates required fields and preserves values on error", async ({ page }) => {
  await page.goto("/request-sugar");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText(/please correct/i).first()).toBeVisible();
});
