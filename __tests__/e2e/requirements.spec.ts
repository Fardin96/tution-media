import { test, expect } from "@playwright/test";
import { sessionCookie } from "./profile-mocks";
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

const INITIAL_REQUIREMENTS: Requirement[] = [
  {
    id: "req-1",
    studentId: "student-id-456",
    categoryId: 1, // Bangla Medium
    areaId: 1, // Dhanmondi
    subjectIds: [1], // Bangla
    classLevel: 9, // Class 9
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
          categoryId: body.categoryId ?? null,
          areaId: body.areaId ?? null,
          subjectIds: body.subjectIds ?? [],
          classLevel: body.classLevel ?? null,
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
      page.getByRole("heading", { name: "Physics · All Classes" }),
    ).toBeVisible();

    // 4. Fill in full fields and post requirement
    await page.goto("/dashboard/requirements/new");

    // Search and select Subject (English) via SubjectPicker
    await page.fill(
      "input[placeholder='Search subjects, like Physics']",
      "English",
    );
    await page.click("button:has-text('English')");

    // Select Class/Level (Class 10)
    await page.selectOption("select", { label: "Class 10" });

    // Select Curriculum (English Version)
    await page.click("label:has-text('English Version')");

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
      page.getByRole("heading", { name: "English · Class 10" }),
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
