import { test, expect } from "@playwright/test";

test.describe("Auth pages", () => {
  for (const [path, heading, switchLabel] of [
    ["/sign-in", "Sign in", "Sign up"],
    ["/sign-up", "Create your account", "Sign in"],
  ] as const) {
    test(`${path} renders Google-only form`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      await expect(
        page.getByText(/with your Google account to continue/),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Continue with Google" }),
      ).toBeVisible();
      await expect(
        page.getByRole("img", { name: "Masters Hub" }),
      ).toBeVisible();
      // No marketing navbar on auth pages.
      await expect(page.locator("header nav")).toHaveCount(0);
      await expect(page.getByRole("link", { name: switchLabel })).toBeVisible();
      // No horizontal scroll.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  }

  test("landing CTAs link to auth", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Get Started" }),
    ).toHaveAttribute("href", "/sign-up");
    const viewAll = page.getByRole("link", { name: "View All" });
    await expect(viewAll).toHaveCount(2);
    for (const link of await viewAll.all())
      await expect(link).toHaveAttribute("href", "/sign-in");
  });

  test("Register Now opens sign up", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "Register Now" }).click();
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Create your account",
    );
  });
});
