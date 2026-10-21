import { test, expect } from "@playwright/test";

test.describe("Auth pages", () => {
  test("/sign-in renders Google-only form", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
    await expect(
      page.getByText(/Sign in with your Google account/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: "Masters Hub" })).toBeVisible();
    // No marketing navbar on auth pages.
    await expect(page.locator("header nav")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
    // No horizontal scroll.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });

  test("/sign-up renders role picker and Google button", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Create your account",
    );
    await expect(
      page.getByText(/Choose how you want to use Masters Hub/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Student Find a tutor" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tutor Offer lessons" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign up with Google" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("landing CTAs link to auth", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Get Started" }),
    ).toHaveAttribute("href", "/sign-in");
    const viewAll = page.getByRole("link", { name: "View All" });
    await expect(viewAll).toHaveCount(2);
    for (const link of await viewAll.all())
      await expect(link).toHaveAttribute("href", "/sign-in");
  });

  test("Register Now opens sign in first", async ({ page, isMobile }) => {
    await page.goto("/");
    if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "Register Now" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  });

  test("dashboard redirects unauthenticated users to sign in", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
