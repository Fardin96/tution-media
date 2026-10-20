import { test, expect } from "@playwright/test";

const mockUser = {
  email: "test@example.com",
  name: "Test User",
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

  test("greets the user and shows the role dialog", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: /Welcome back/ }),
    ).toHaveText(`Welcome back, ${mockUser.name}`);
    await expect(page.getByText(mockUser.email)).toBeVisible();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("How do you want to use Masters Hub?");

    // Choosing a role closes the dialog.
    await page.getByRole("button", { name: "Student" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(dialog).not.toBeVisible();
  });

  test("logout clears the session and redirects to sign in", async ({
    page,
    context,
  }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(mockUser.email)).toBeVisible();

    // Close the role dialog so the logout button is reachable.
    await page.getByRole("button", { name: "Student" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "session")).toBeUndefined();
  });
});
