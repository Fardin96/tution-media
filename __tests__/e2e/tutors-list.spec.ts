import { test, expect, type Page } from "@playwright/test";
import type { components } from "@/lib/api-types";
import {
  areasMock,
  mockApi,
  sessionCookie,
  subjectsMock,
} from "./profile-mocks";

type Schemas = components["schemas"];

// Physics is id 5 in subjectsMock.
const PHYSICS_ID = 5;

const TUTORS = [
  {
    id: "tutor-public-1",
    name: "Nusrat Jahan",
    instituteName: "University of Dhaka",
    gender: "FEMALE",
    avatarUrl: null,
    ratingAvg: 4.5,
    ratingCount: 12,
    areas: [{ id: 1, name: "Dhanmondi" }],
    subjects: [{ id: PHYSICS_ID, name: "Physics" }],
  },
  {
    id: "tutor-public-2",
    name: "Rafi Ahmed",
    instituteName: "BUET",
    gender: "MALE",
    avatarUrl: null,
    ratingAvg: 0,
    ratingCount: 0,
    areas: [{ id: 2, name: "Gulshan" }],
    subjects: [{ id: 7, name: "Biology" }],
  },
] satisfies Schemas["TutorSearchResult"][];

/** The subject and area lists the landing search and the list pickers read. */
async function mockLookups(page: Page) {
  await page.route("**/api/v1/subjects", (route) =>
    route.fulfill({ json: subjectsMock }),
  );
  await page.route("**/api/v1/areas", (route) =>
    route.fulfill({ json: areasMock }),
  );
}

/** Answers GET /api/v1/tutors?… with two tutors and records every request URL. */
async function mockTutors(page: Page) {
  const requests: URL[] = [];
  await page.route("**/api/v1/tutors?**", (route) => {
    requests.push(new URL(route.request().url()));
    return route.fulfill({
      json: {
        tutors: TUTORS,
        nextCursor: null,
      } satisfies Schemas["TutorSearchList"],
    });
  });
  return requests;
}

test("the landing search opens the tutors list for a typed skill", async ({
  page,
}) => {
  await mockLookups(page);
  await mockTutors(page);
  await page.goto("/");

  const skill = page.getByRole("combobox", { name: "Skill or role" });
  await skill.fill("phys");
  const popup = page.getByRole("listbox", { name: "Subject suggestions" });
  await expect(popup.getByRole("option", { name: /Physics/ })).toBeVisible();
  await skill.press("ArrowDown");
  await skill.press("Enter");
  await page.getByRole("button", { name: /search/i }).click();

  await expect(page).toHaveURL(new RegExp(`/tutors\\?subject=${PHYSICS_ID}$`));
  await expect(page.getByRole("link", { name: /Nusrat Jahan/ })).toBeVisible();
});

test("View All on the landing opens the emerging masters list", async ({
  page,
}) => {
  await mockLookups(page);
  const requests = await mockTutors(page);
  await page.goto("/");

  await page.getByRole("link", { name: "View All" }).click();

  await expect(page).toHaveURL(/\/tutors\?sort=emerging$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Emerging masters" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      requests.some((url) => url.searchParams.get("recent") === "true"),
    )
    .toBe(true);
});

test("a signed-out visitor who opens a tutor is asked to sign in first", async ({
  page,
}) => {
  await mockLookups(page);
  await mockTutors(page);
  await page.goto("/tutors");

  await page.getByRole("link", { name: /Nusrat Jahan/ }).click();

  await expect(page).toHaveURL(/\/sign-in\?next=%2Ftutors%2Ftutor-public-1$/);
});

/**
 * Answers the profile's API GET and its client-side RSC navigation after a delay, so a loading
 * boundary on /tutors/[id] would stay on screen long enough to be seen.
 */
async function mockSlowProfile(page: Page, delayMs: number) {
  const tutor = {
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
    subjects: [{ id: PHYSICS_ID, name: "Physics" }],
    credentials: [],
    videos: [],
  } satisfies Schemas["TutorPublicProfile"];
  await page.route("**/api/v1/tutors/tutor-public-1", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        tutor,
      } satisfies Schemas["TutorPublicProfileResult"]),
    });
  });
  // The client-side link to /tutors/tutor-public-1 fetches its RSC payload from the app server.
  await page.route("**/tutors/tutor-public-1", async (route) => {
    if (route.request().headers()["rsc"] !== "1") return route.fallback();
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return route.continue();
  });
}

test("opening a tutor profile from the list never shows the list's loading boundary", async ({
  page,
  context,
}) => {
  // Records any [data-list-loading] marker the list's loading boundary renders, once armed.
  await page.addInitScript(() => {
    const w = window as unknown as {
      __sawListLoading: boolean;
      __armed: boolean;
    };
    w.__sawListLoading = false;
    w.__armed = false;
    const check = () => {
      if (w.__armed && document.querySelector("[data-list-loading]"))
        w.__sawListLoading = true;
    };
    new MutationObserver(check).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    check();
  });
  await context.addCookies([sessionCookie("STUDENT")]);
  await mockApi(context, "STUDENT", { onboarded: true });
  await mockLookups(page);
  await mockTutors(page);
  await mockSlowProfile(page, 800);

  await page.goto("/tutors");
  const card = page.getByRole("link", { name: /Nusrat Jahan/ });
  await expect(card).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __armed: boolean }).__armed = true;
  });

  await card.click();

  await expect(page).toHaveURL(/\/tutors\/tutor-public-1$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Nusrat Jahan" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __sawListLoading: boolean }).__sawListLoading,
    ),
  ).toBe(false);
});

test("the header Sign in on the list keeps the list URL as next", async ({
  page,
}) => {
  await mockLookups(page);
  await mockTutors(page);
  await page.goto("/tutors?sort=emerging");

  const signIn = page.locator("header").getByRole("link", { name: "Sign in" });
  await expect(signIn).toHaveAttribute("href", /^\/sign-in\?next=%2Ftutors/);
});

test("a free-text subject that matches nothing shows the notice", async ({
  page,
}) => {
  await mockLookups(page);
  await mockTutors(page);
  await page.goto("/tutors?q=zzzz");

  await expect(
    page.getByText("No subject matches “zzzz”, so all subjects are shown."),
  ).toBeVisible();
});

test("the tutors list and the landing suggestions fit at 320px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await mockLookups(page);
  await mockTutors(page);

  await page.goto("/tutors");
  await expect(
    page.getByRole("heading", { level: 1, name: "Find tutors" }),
  ).toBeVisible();
  const listOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(listOverflow).toBe(false);

  await page.goto("/");
  await page.getByRole("combobox", { name: "Skill or role" }).fill("phys");
  const popup = page.getByRole("listbox", { name: "Subject suggestions" });
  await expect(popup).toBeVisible();
  const box = await popup.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
});
