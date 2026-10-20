import { test, expect } from "@playwright/test";

const mockUser = {
  id: "acc_1",
  email: "test@example.com",
  name: "Test User",
  role: "STUDENT",
  picture: "https://lh3.googleusercontent.com/a-/test.png",
};

test.describe("Dashboard", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      {
        name: "session",
        value: JSON.stringify(mockUser),
        domain: "localhost",
        path: "/",
        httpOnly: true,
      },
    ]);
  });

  test("greets the user", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /Welcome back/ }),
    ).toHaveText(`Welcome back, ${mockUser.name}`);
    await expect(page.getByText(mockUser.email)).toBeVisible();
    await expect(page.getByText(mockUser.role)).toBeVisible();
  });

  test("logout clears the session and redirects to sign in", async ({
    page,
    context,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(mockUser.email)).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "session")).toBeUndefined();
  });
});
