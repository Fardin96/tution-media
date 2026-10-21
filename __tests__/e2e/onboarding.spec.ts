import { test, expect } from "@playwright/test";
import { mockApi, sessionCookie } from "./profile-mocks";

test.describe("Onboarding", () => {
  test("student completes all steps and lands on the dashboard", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    const writes = await mockApi(context, "STUDENT", { onboarded: false });
    await page.goto("/onboarding");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "About you",
    );
    await expect(page.getByLabel("Full name")).toHaveValue("Test User");

    // Required fields block the step.
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter your student ID number.")).toBeVisible();
    await expect(page.getByLabel("Student ID number")).toBeFocused();

    await page.getByLabel("Student ID number").fill("NDC-1");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contact");
    await page.getByLabel("WhatsApp number").fill("123");
    await page.getByLabel("Emergency contact number").fill("01911111111");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText(/11-digit Bangladeshi number/)).toBeVisible();
    await page.getByLabel("WhatsApp number").fill("01712 345678");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Location",
    );
    await page.getByRole("searchbox", { name: "Search areas" }).fill("dhan");
    await page.getByText("Dhanmondi", { exact: true }).click();
    await page.getByLabel("Address").fill("House 1, Road 2");
    await page.getByRole("button", { name: "Finish setup" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Test User",
    );
    expect(writes[0]).toEqual({
      method: "POST",
      path: "/students/me",
      body: {
        name: "Test User",
        studentIdNumber: "NDC-1",
        whatsappNumber: "+8801712345678",
        emergencyContact: "+8801911111111",
        areaId: 1,
        address: "House 1, Road 2",
      },
    });
  });

  test("tutor saves profile, subjects and areas", async ({ page, context }) => {
    await context.addCookies([sessionCookie("TUTOR")]);
    const writes = await mockApi(context, "TUTOR", { onboarded: false });
    await page.goto("/onboarding");

    await page.getByText("Female", { exact: true }).click();
    await page.getByLabel("University student ID").fill("1805123");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("WhatsApp number").fill("01712345678");
    await page.getByLabel("Emergency contact number").fill("01911111111");
    await page.getByLabel("Address").fill("Mirpur 10");
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Teaching",
    );
    await page.getByText("Physics", { exact: true }).click();
    await page.getByText("Uttara", { exact: true }).click();
    await page.getByRole("button", { name: "Finish setup" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    expect(writes.map((w) => `${w.method} ${w.path}`).sort()).toEqual([
      "POST /tutors/me",
      "PUT /tutors/me/areas",
      "PUT /tutors/me/subjects",
    ]);
    expect(writes.find((w) => w.path === "/tutors/me/subjects")?.body).toEqual({
      subjectIds: [5],
    });
  });

  test("onboarded users skip straight to the dashboard", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    await mockApi(context, "STUDENT", { onboarded: true });
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("dashboard sends new users to onboarding", async ({ page, context }) => {
    await context.addCookies([sessionCookie("TUTOR")]);
    await mockApi(context, "TUTOR", { onboarded: false });
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding$/);
  });
});
