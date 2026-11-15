import { test, expect } from "@playwright/test";
import { sessionCookie } from "./profile-mocks";
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
