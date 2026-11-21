import { test, expect, type BrowserContext } from "@playwright/test";
import { areasMock, sessionCookie, subjectsMock } from "./profile-mocks";
import type { components } from "@/lib/api-types";
import type { EducationLookup } from "@/lib/education";
import type { Requirement } from "@/lib/requirements";

const MOCK_ME = {
  account: {
    id: "acc_1",
    role: "STUDENT",
    email: "student@example.com",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    student: {
      id: "student-id-456",
      name: "Tasin Farhan",
      address: "Dhanmondi, Dhaka",
      emergencyContact: "+8801700000000",
      phoneNumber: "+8801700000001",
      whatsappNumber: "+8801700000000",
      whatsappVerifiedAt: "2026-01-01T00:00:00.000Z",
      studentIdNumber: "STUDENT-123",
      verificationStatus: "APPROVED",
      ratingAvg: "5.0",
      ratingCount: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      areaId: 1,
    },
    tutor: null,
  },
};

// Mirrors the body of GET /lookups/education (tuition-api/src/lib/education.ts, educationLookup()).
const EDUCATION_LOOKUP: EducationLookup = {
  version: 1,
  levelRange: { min: -4, max: 13 },
  groupLevels: { min: 9, max: 12 },
  admissionLevel: 13,
  levelNoteMaxLength: 40,
  curricula: [
    {
      code: "BANGLA_MEDIUM",
      label: "Bangla Medium",
      levels: [
        { code: -2, label: "Playgroup" },
        { code: -1, label: "Nursery" },
        { code: 0, label: "KG" },
        { code: 1, label: "Class 1" },
        { code: 2, label: "Class 2" },
        { code: 3, label: "Class 3" },
        { code: 4, label: "Class 4" },
        { code: 5, label: "Class 5" },
        { code: 6, label: "Class 6" },
        { code: 7, label: "Class 7" },
        { code: 8, label: "Class 8" },
        { code: 9, label: "Class 9" },
        { code: 10, label: "Class 10 (SSC)" },
        { code: 11, label: "HSC 1st year" },
        { code: 12, label: "HSC 2nd year" },
        { code: 13, label: "Admission & test prep" },
      ],
      groups: [
        { code: "SCIENCE", label: "Science" },
        { code: "BUSINESS", label: "Business Studies" },
        { code: "HUMANITIES", label: "Humanities" },
      ],
    },
    {
      code: "EM_CAMBRIDGE",
      label: "English Medium (Cambridge)",
      levels: [
        { code: 0, label: "KG 2 (Year 1)" },
        { code: 9, label: "Grade 9 (Year 10, O Level)" },
        { code: 10, label: "Grade 10 (Year 11, O Level)" },
        { code: 11, label: "Grade 11 (Year 12, AS Level)" },
        { code: 12, label: "Grade 12 (Year 13, A2 Level)" },
        { code: 13, label: "Admission & test prep" },
      ],
      groups: [],
    },
  ],
  admissionTargets: [
    {
      code: "ENGINEERING",
      label: "Engineering",
      covers: "BUET, CKRUET, IUT, MIST, BUTEX",
    },
    { code: "MEDICAL", label: "Medical", covers: "MBBS/BDS, AFMC" },
    {
      code: "ABROAD_TESTS",
      label: "Study abroad tests",
      covers: "SAT, IELTS, TOEFL, Duolingo, GED",
    },
  ],
  retakerLabels: [
    { level: 10, label: "Retake / improvement" },
    { level: 12, label: "Retake / improvement" },
    { level: 13, label: "2nd timer" },
  ],
};

const INITIAL_REQUIREMENTS: Requirement[] = [
  {
    id: "req-1",
    studentId: "student-id-456",
    areaId: 1, // Dhanmondi
    subjectIds: [1], // Bangla
    curriculum: "BANGLA_MEDIUM",
    levelCode: 9, // Class 9
    academicGroup: null,
    admissionTargets: [],
    isRetaker: false,
    levelNote: null,
    timeOfDay: "18:00",
    daysPerWeek: 3,
    availableDays: 127,
    salary: 8000,
    studentCount: 1,
    hireByDate: "2026-11-15",
    tutorGenderPref: "ANY",
    instituteName: "Dhanmondi School",
    tuitionType: "Home Tutoring Solo",
    status: "OPEN",
    createdAt: "2026-10-26T00:00:00.000Z",
    updatedAt: "2026-10-26T00:00:00.000Z",
  },
];

test.describe("Student tuition requirements flow", () => {
  test("browsing, drafting, creating, editing, and closing requirements", async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    const mockReqs: Requirement[] = JSON.parse(
      JSON.stringify(INITIAL_REQUIREMENTS),
    );

    await context.addCookies([sessionCookie("STUDENT")]);

    await context.route("**/api/v1/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname.replace("/api/v1", "");
      const method = req.method();

      if (path === "/me") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_ME),
        });
      }

      if (path === "/subjects" && method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(subjectsMock),
        });
      }

      if (path === "/areas" && method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(areasMock),
        });
      }

      if (path === "/lookups/education" && method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(EDUCATION_LOOKUP),
        });
      }

      if (path === "/requirements/mine" && method === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ requirements: mockReqs }),
        });
      }

      if (path === "/requirements" && method === "POST") {
        const body = (req.postDataJSON() || {}) as Partial<Requirement>;
        const newReq: Requirement = {
          id: `req-new-${Date.now()}`,
          studentId: "student-id-456",
          areaId: body.areaId ?? null,
          subjectIds: body.subjectIds ?? [],
          curriculum: body.curriculum ?? null,
          levelCode: body.levelCode ?? null,
          academicGroup: body.academicGroup ?? null,
          admissionTargets: body.admissionTargets ?? [],
          isRetaker: body.isRetaker ?? false,
          levelNote: body.levelNote ?? null,
          timeOfDay: body.timeOfDay ?? null,
          daysPerWeek: body.daysPerWeek ?? null,
          availableDays: body.availableDays ?? 127,
          salary: body.salary ?? null,
          studentCount: body.studentCount ?? 1,
          hireByDate: body.hireByDate ?? null,
          tutorGenderPref: body.tutorGenderPref ?? "ANY",
          instituteName: body.instituteName ?? null,
          tuitionType: body.tuitionType ?? null,
          status: body.status ?? "OPEN",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        mockReqs.unshift(newReq);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(newReq),
        });
      }

      if (path.startsWith("/requirements/")) {
        const parts = path.split("/");
        const id = parts[2];
        const subPath = parts[3];

        if (subPath === "close" && method === "POST") {
          const reqIndex = mockReqs.findIndex((r) => r.id === id);
          if (reqIndex !== -1) {
            mockReqs[reqIndex] = { ...mockReqs[reqIndex], status: "CLOSED" };
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(mockReqs[reqIndex]),
            });
          }
          return route.fulfill({ status: 404 });
        }

        const foundReq = mockReqs.find((r) => r.id === id);
        if (method === "GET") {
          if (foundReq) {
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(foundReq),
            });
          }
          return route.fulfill({ status: 404 });
        }

        if (method === "PATCH") {
          const body = (req.postDataJSON() || {}) as Partial<Requirement>;
          const reqIndex = mockReqs.findIndex((r) => r.id === id);
          if (reqIndex !== -1) {
            mockReqs[reqIndex] = { ...mockReqs[reqIndex], ...body };
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify(mockReqs[reqIndex]),
            });
          }
          return route.fulfill({ status: 404 });
        }
      }

      return route.continue();
    });

    // Go to dashboard
    await page.goto("/dashboard");

    // 1. Verify requirements section is displayed on dashboard
    const requirementsSection = page.locator("#requirements");
    await expect(requirementsSection).toBeVisible();

    const requirementItem = requirementsSection.locator("li").first();
    await expect(requirementItem).toBeVisible();
    await expect(requirementItem.locator("h3")).toContainText(
      "Bangla · Class 9",
    );

    // Drop the seeded requirement before the create flow. Prefill would copy its
    // curriculum and level into the new form, and the empty-draft check would
    // never fire.
    mockReqs.length = 0;

    // 2. Test saving empty draft shows prompt
    await page.goto("/dashboard/requirements/new");
    await page.click("button:has-text('Save as draft')");
    await expect(
      page.locator("text=Enter at least one detail to save as a draft."),
    ).toBeVisible();

    // 3. Save a partial draft with just a subject selected via SubjectPicker
    await page.fill(
      "input[placeholder='Search subjects, like Physics']",
      "Physics",
    );
    await page.click("button:has-text('Physics')");
    await page.click("button:has-text('Save as draft')");

    // Wait for redirect to dashboard
    await page.waitForURL((url) => url.pathname === "/dashboard");
    await expect(page.locator("text=Saved as draft")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Physics · Class not set" }),
    ).toBeVisible();

    // 4. Fill in full fields and post requirement
    await page.goto("/dashboard/requirements/new");

    // Search and select Subject (English) via SubjectPicker
    await page.fill(
      "input[placeholder='Search subjects, like Physics']",
      "English",
    );
    await page.click("button:has-text('English')");

    // Select Curriculum (Bangla Medium). The lookup loads async; the click auto-waits.
    // Chips hide the native input (sr-only) under their label, so click the label text.
    await page.getByText("Bangla Medium", { exact: true }).click();
    await expect(
      page.getByRole("radio", { name: "Bangla Medium" }),
    ).toBeChecked();

    // Select Class/Level (Class 9)
    await page
      .getByRole("combobox", { name: "Class", exact: true })
      .selectOption({ label: "Class 9" });

    // Class 9 is in the group range, so the optional group step appears
    await expect(page.getByText("Group (optional)")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Science" })).toBeVisible();

    // Select Area (Dhanmondi)
    await page.fill(
      "input[placeholder='Search areas, like Dhanmondi']",
      "Dhanmondi",
    );
    await page.click("button:has-text('Dhanmondi')");

    // Fill in School or college (required)
    await page.fill(
      "input[placeholder='Viqarunnisa Noon School']",
      "Viqarunnisa Noon School",
    );

    // Fill in Preferred time
    await page.fill("input[type='time']", "16:00");

    // Fill in salary
    await page.fill("input[placeholder='8,000']", "12500");
    await page.locator("input[placeholder='8,000']").blur();
    await expect(page.locator("input[placeholder='8,000']")).toHaveValue(
      "12,500",
    );

    // Submit form
    await page.click("button:has-text('Post requirement')");

    // Wait for redirect to dashboard
    await page.waitForURL((url) => url.pathname === "/dashboard");

    // Verify confirmation success pill
    await expect(page.locator("text=Requirement posted")).toBeVisible();

    // Verify new requirement is displayed
    await expect(
      page.getByRole("heading", { name: "English · Class 9" }),
    ).toBeVisible();

    // 5. Edit Requirement
    const editLink = page.locator("a:has-text('Edit')").first();
    await editLink.click();
    await page.waitForURL("**/dashboard/requirements/*/edit");

    // Change salary to 15,000
    await page.fill("input[placeholder='8,000']", "15000");
    await page.locator("input[placeholder='8,000']").blur();
    await page.click("button:has-text('Save changes')");

    // Wait for redirect to dashboard
    await page.waitForURL((url) => url.pathname === "/dashboard");
    await expect(page.locator("text=Changes saved")).toBeVisible();
    await expect(page.locator("text=৳15,000 / month")).toBeVisible();

    // 6. Close Requirement
    const closeBtn = page.locator("button:has-text('Close')").first();
    await closeBtn.click();

    // Verify close inline confirmation message
    await expect(page.locator("text=Close this requirement?")).toBeVisible();

    // Confirm close
    await page.click("button:has-text('Yes, close')");

    // Verify status changes to Closed and actions disappear
    const closedPill = page.locator("span:has-text('Closed')").first();
    await expect(closedPill).toBeVisible();
  });
});

type Schemas = components["schemas"];
type RecordedWrite = { method: string; path: string; body: unknown };

const DAY_MS = 24 * 60 * 60 * 1000;

/** The hire-by date "Post again" resets to: 14 days from now, as a calendar date in Asia/Dhaka. */
function dhakaDateInDays(days: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(new Date(Date.now() + days * DAY_MS));
}

// Past requirements, as GET /requirements/mine returns them. Class, area and days are set
// away from the form defaults so the test can see them copied.
const PAST_CLOSED = {
  id: "req-closed-1",
  studentId: "student-id-456",
  areaId: 1, // Dhanmondi
  subjectIds: [1], // Bangla
  curriculum: "BANGLA_MEDIUM",
  levelCode: 9, // Class 9
  academicGroup: null,
  admissionTargets: [],
  isRetaker: false,
  levelNote: null,
  timeOfDay: "18:00",
  daysPerWeek: 2,
  availableDays: 74, // Sunday, Tuesday, Friday
  salary: 8000,
  studentCount: 1,
  hireByDate: "2026-03-20",
  tutorGenderPref: "ANY",
  instituteName: "Dhanmondi School",
  tuitionType: "Home Tutoring Solo",
  status: "CLOSED",
  createdAt: "2026-03-12T00:00:00.000Z",
  updatedAt: "2026-03-20T00:00:00.000Z",
} satisfies Schemas["Requirement"];

const PAST_FILLED = {
  ...PAST_CLOSED,
  id: "req-filled-1",
  areaId: 2, // Gulshan
  subjectIds: [2], // English
  timeOfDay: "17:00",
  daysPerWeek: 3,
  availableDays: 127,
  salary: 12000,
  status: "FILLED",
} satisfies Schemas["Requirement"];

// Subject 99 is not in GET /subjects, so the copy has to drop it.
const PAST_RETIRED_SUBJECT = {
  ...PAST_CLOSED,
  id: "req-retired-1",
  subjectIds: [1, 99],
} satisfies Schemas["Requirement"];

const OPEN_REQUIREMENT = {
  ...PAST_CLOSED,
  id: "req-open-1",
  hireByDate: "2026-12-01",
  status: "OPEN",
  updatedAt: "2026-11-01T00:00:00.000Z",
} satisfies Schemas["Requirement"];

const NOT_FOUND_BODY = {
  error: "NotFound",
  code: "NOT_FOUND",
  message: "Requirement not found.",
} satisfies Schemas["ErrorResponse"];

// What the API sends for POST /requirements when the student already has a matching OPEN one.
const DUPLICATE_BODY = {
  error: "RequirementDuplicate",
  code: "REQUIREMENT_DUPLICATE",
  message: "You already have an open requirement like this one.",
  details: { requirementId: OPEN_REQUIREMENT.id },
} satisfies Schemas["ErrorResponse"];

/**
 * Fakes the requirement endpoints a student's dashboard, Post again page and applicants page
 * read. `requirements` answers both GET /requirements/mine and GET /requirements/{id}; other
 * ids answer 404. Returns every write request made, in order.
 */
async function mockPostAgainApi(
  context: BrowserContext,
  requirements: Schemas["Requirement"][],
  opts: { duplicateOf?: string } = {},
) {
  const writes: RecordedWrite[] = [];

  await context.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/v1", "");
    const method = req.method();
    if (method !== "GET") {
      let body: unknown = null;
      try {
        body = req.postDataJSON();
      } catch {
        body = null;
      }
      writes.push({ method, path, body });
    }

    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (path === "/me") return json(MOCK_ME);
    if (path === "/subjects") return json(subjectsMock);
    if (path === "/areas") return json(areasMock);
    if (path === "/lookups/education") return json(EDUCATION_LOOKUP);

    if (path === "/requirements/mine" && method === "GET") {
      return json({
        requirements,
      } satisfies Schemas["RequirementList"]);
    }

    if (path === "/requirements" && method === "POST") {
      if (opts.duplicateOf) return json(DUPLICATE_BODY, 409);
      // The form only checks that the request succeeded, so the body is not read back.
      return json({ id: "req-posted-1" }, 201);
    }

    const match = path.match(
      /^\/requirements\/([^/]+)(\/applications|\/tutors)?$/,
    );
    if (match && method === "GET") {
      const [, id, sub] = match;
      const found = requirements.find((r) => r.id === id);
      if (!found) return json(NOT_FOUND_BODY, 404);
      if (sub === "/applications") {
        return json({
          applications: [],
          nextCursor: null,
        } satisfies Schemas["ApplicationPage"]);
      }
      if (sub === "/tutors") {
        return json({
          tutors: [],
          total: 0,
          page: 1,
          hasMore: false,
          matchVersion: 1,
          suggestions: [],
        } satisfies Schemas["RecommendedTutorPage"]);
      }
      return json(found);
    }

    return route.continue();
  });

  return writes;
}

test.describe("Post again", () => {
  test("copies a closed requirement into a new post and sends it as a create", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    const writes = await mockPostAgainApi(context, [PAST_CLOSED]);

    await page.goto("/dashboard");
    await expect(page.locator("#past-requirements > li")).toHaveCount(1);
    await page
      .getByRole("link", { name: "Post again Bangla · Class 9" })
      .click();

    await page.waitForURL(
      (url) =>
        url.pathname === "/dashboard/requirements/new" &&
        url.searchParams.get("from") === PAST_CLOSED.id,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Post again" }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({
        hasText:
          "Copied from your requirement posted on 12 Mar 2026. Check the class, time and salary before posting.",
      }),
    ).toBeVisible();

    // Prefilled from the source: subject, area, class, salary and hire-by date.
    await expect(
      page.getByRole("button", { name: "Remove Bangla" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remove Dhanmondi" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("combobox", { name: "Class", exact: true })
        .locator("option:checked"),
    ).toHaveText("Class 9");
    await expect(page.locator("input[placeholder='8,000']")).toHaveValue(
      "8000",
    );
    await expect(page.getByLabel("Hire by date", { exact: true })).toHaveValue(
      dhakaDateInDays(14),
    );

    await page.getByRole("button", { name: "Post requirement" }).click();
    await page.waitForURL((url) => url.pathname === "/dashboard");
    await expect(
      page.getByText("Requirement posted", { exact: true }),
    ).toBeVisible();

    const posts = writes.filter((w) => w.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe("/requirements");
    expect(writes.some((w) => w.method === "PATCH")).toBe(false);

    expect(posts[0].body).toMatchObject({
      subjectIds: [1],
      levelCode: 9,
      curriculum: "BANGLA_MEDIUM",
      areaId: 1,
      salary: 8000,
      tuitionType: "Home Tutoring Solo",
      daysPerWeek: 2,
      availableDays: 74,
      timeOfDay: "18:00",
      instituteName: "Dhanmondi School",
      status: "OPEN",
      hireByDate: dhakaDateInDays(14),
    });
    for (const key of ["id", "studentId", "createdAt", "updatedAt"]) {
      expect(posts[0].body).not.toHaveProperty(key);
    }
  });

  test("a filled requirement shows Tutor hired, Post again, and no Edit or Close", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    await mockPostAgainApi(context, [PAST_FILLED]);

    await page.goto("/dashboard");
    const card = page.locator("#past-requirements > li");
    await expect(card).toHaveCount(1);
    await expect(card.getByText("Tutor hired", { exact: true })).toBeVisible();
    await expect(
      card.getByRole("link", { name: /^Post again/ }),
    ).toHaveAttribute(
      "href",
      `/dashboard/requirements/new?from=${PAST_FILLED.id}`,
    );
    await expect(card.getByRole("link", { name: /^Edit/ })).toHaveCount(0);
    await expect(card.getByRole("button", { name: /^Close/ })).toHaveCount(0);
  });

  test("a duplicate open requirement offers a link to edit it instead", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    const writes = await mockPostAgainApi(
      context,
      [PAST_CLOSED, OPEN_REQUIREMENT],
      { duplicateOf: OPEN_REQUIREMENT.id },
    );

    await page.goto(`/dashboard/requirements/new?from=${PAST_CLOSED.id}`);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Copied from your requirement" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Post requirement" }).click();

    await expect(
      page.getByText(
        "You already have an open requirement like this one. Edit it instead.",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Edit the open requirement" }),
    ).toHaveAttribute(
      "href",
      `/dashboard/requirements/${OPEN_REQUIREMENT.id}/edit`,
    );
    // The student stays on the copy so nothing is lost.
    await expect(page).toHaveURL(
      new RegExp(`/dashboard/requirements/new\\?from=${PAST_CLOSED.id}$`),
    );
    expect(writes.filter((w) => w.method === "POST")).toHaveLength(1);
  });

  test("a subject no longer offered is dropped, with a notice", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    const writes = await mockPostAgainApi(context, [PAST_RETIRED_SUBJECT]);

    await page.goto(
      `/dashboard/requirements/new?from=${PAST_RETIRED_SUBJECT.id}`,
    );
    await expect(
      page.getByText("Removed 1 subject that's no longer offered.", {
        exact: true,
      }),
    ).toBeVisible();
    // Bangla is kept; the removed subject never reaches the picker.
    await expect(
      page.getByRole("button", { name: "Remove Bangla" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Post requirement" }).click();
    await page.waitForURL((url) => url.pathname === "/dashboard");

    const posts = writes.filter((w) => w.method === "POST");
    expect(posts.map((w) => w.body)).toEqual([
      expect.objectContaining({ subjectIds: [1] }),
    ]);
  });

  test("a requirement that cannot be copied opens a blank form with a notice", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    await mockPostAgainApi(context, []);

    await page.goto("/dashboard/requirements/new?from=req-missing");
    await expect(
      page.getByRole("status").filter({
        hasText: "We couldn't copy that requirement. Start from a blank form.",
      }),
    ).toBeVisible();

    await expect(page.locator("input[placeholder='8,000']")).toHaveValue("");
    await expect(page.getByRole("button", { name: /^Remove / })).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Post requirement" }),
    ).toBeVisible();
  });

  test("the applicants page offers Post again for a past requirement only", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    await mockPostAgainApi(context, [PAST_CLOSED, OPEN_REQUIREMENT]);

    await page.goto(`/dashboard/requirements/${PAST_CLOSED.id}/applicants`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Applicants" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Post again", exact: true }),
    ).toHaveAttribute(
      "href",
      `/dashboard/requirements/new?from=${PAST_CLOSED.id}`,
    );

    await page.goto(
      `/dashboard/requirements/${OPEN_REQUIREMENT.id}/applicants`,
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Applicants" }),
    ).toBeVisible();
    // The recommended tutors section only renders once the requirement is known to be OPEN.
    await expect(
      page.getByRole("heading", { name: "Recommended tutors" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Post again", exact: true }),
    ).toHaveCount(0);
  });

  test("the Post again page with its notice has no horizontal scroll at 320px", async ({
    page,
    context,
  }) => {
    await context.addCookies([sessionCookie("STUDENT")]);
    await mockPostAgainApi(context, [PAST_CLOSED]);

    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/dashboard/requirements/new?from=${PAST_CLOSED.id}`);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Copied from your requirement" }),
    ).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
