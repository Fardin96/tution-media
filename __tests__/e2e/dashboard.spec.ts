import { test, expect } from "@playwright/test";
import { mockApi, sessionCookie } from "./profile-mocks";

test.describe("Dashboard", () => {
  test("shows the student profile and saves an edit", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    const writes = await mockApi(context, "STUDENT", { onboarded: true });
    await page.goto("/dashboard");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Rahim Uddin",
    );
    await expect(page.getByText("+880 1712-345678").first()).toBeVisible();

    await page.getByRole("button", { name: "Edit contact" }).click();
    await expect(page.getByLabel("WhatsApp number")).toBeFocused();
    await page.getByLabel("WhatsApp number").fill("01812345678");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Changes saved")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit contact" }),
    ).toBeFocused();
    expect(writes).toEqual([
      {
        method: "PATCH",
        path: "/students/me",
        body: {
          whatsappNumber: "+8801812345678",
          emergencyContact: "+8801911111111",
        },
      },
    ]);
  });

  test("tutor sees teaching details from the public profile", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("TUTOR")]);
    await mockApi(context, "TUTOR", { onboarded: true });
    await page.goto("/dashboard");

    const teaching = page.getByRole("region", { name: "Teaching" });
    await expect(teaching.getByText("Physics")).toBeVisible();
    await expect(teaching.getByText("Dhanmondi")).toBeVisible();
    await expect(page.getByText("No credentials yet")).toBeVisible();
  });

  test("has no horizontal scroll", async ({ page, context }) => {
    await context.addCookies([sessionCookie("TUTOR")]);
    await mockApi(context, "TUTOR", { onboarded: true });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });

  test("logout clears the session and redirects to sign in", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    await mockApi(context, "STUDENT", { onboarded: true });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === "session")).toBeUndefined();
  });
});
