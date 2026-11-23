import { test, expect } from "@playwright/test";
import type { components } from "@/lib/api-types";
import { mockApi, sessionCookie } from "./profile-mocks";

type Schemas = components["schemas"];

const TUTOR = {
  id: "tutor-public-1",
  name: "Nusrat Jahan",
  avatarUrl: null,
  gender: "FEMALE",
  instituteName: "University of Dhaka",
  ratingAvg: 4.5,
  ratingCount: 12,
  verificationStatus: "APPROVED",
  isListed: true,
  needsReaddress: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  areas: [{ id: 1, name: "Dhanmondi" }],
  subjects: [{ id: 5, name: "Physics" }],
  credentials: [
    {
      id: "cred-1",
      examLabel: "SSC",
      result: "A+",
      file: { id: "file-cred-1", status: "UPLOADED" },
    },
  ],
  videos: [],
} satisfies Schemas["TutorPublicProfile"];

/** Answers GET /api/v1/tutors/:id: the known tutor, or a 404 for any other id. */
async function mockTutorProfile(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/tutors/**", (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop();
    if (id === TUTOR.id) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          tutor: TUTOR,
        } satisfies Schemas["TutorPublicProfileResult"]),
      });
    }
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        error: "NotFound",
        code: "NOT_FOUND",
        message: "Tutor not found",
      } satisfies Schemas["ErrorResponse"]),
    });
  });
}

test("a signed-out visitor sees the public tutor profile", async ({ page }) => {
  await mockTutorProfile(page);
  await page.goto(`/tutors/${TUTOR.id}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Nusrat Jahan" }),
  ).toBeVisible();
  await expect(page.getByText("University of Dhaka")).toBeVisible();
  await expect(page.getByText("SSC — A+")).toBeVisible();
  await expect(page.getByRole("region", { name: "Subjects" })).toContainText(
    "Physics",
  );

  // The slim public frame: logo home and "Sign in", no marketing navbar or footer.
  await expect(
    page.getByRole("link", { name: "Masters Hub Home" }),
  ).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/sign-in",
  );
  await expect(page.getByText("Register Now")).toHaveCount(0);
  await expect(page.locator("footer")).toHaveCount(0);
});

test("a signed-in visitor gets the dashboard frame", async ({
  page,
  context,
}) => {
  await context.addCookies([sessionCookie("STUDENT")]);
  await mockApi(context, "STUDENT", { onboarded: true });
  await mockTutorProfile(page);
  await page.goto(`/tutors/${TUTOR.id}`);

  await expect(
    page.getByRole("heading", { level: 1, name: TUTOR.name }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Masters Hub Home" }),
  ).toHaveAttribute("href", "/dashboard");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  await expect(page.getByText("Register Now")).toHaveCount(0);
});

test("an unknown tutor id shows the not-available card", async ({ page }) => {
  await mockTutorProfile(page);
  await page.goto("/tutors/no-such-tutor");

  await expect(
    page.getByRole("heading", { name: "This tutor profile isn't available." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Home", exact: true }),
  ).toHaveAttribute("href", "/");
});

test("the tutor profile has no horizontal scroll at 320px", async ({
  page,
}) => {
  await mockTutorProfile(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`/tutors/${TUTOR.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: TUTOR.name }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
