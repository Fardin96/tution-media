import {
  test,
  expect,
  type BrowserContext,
  type Route,
} from "@playwright/test";
import { sessionCookie, tutorProfile } from "./profile-mocks";
import type { EducationLookup } from "@/lib/education";
import type { TutorRequirement } from "@/lib/tutor-requirements";

const TUTOR_PROFILE_ID = "p_1";

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

// Matches the ids in SUBJECTS (lib/profile.ts).
const SUBJECT_NAMES: Record<number, string> = {
  1: "Bangla",
  2: "English",
  3: "Mathematics",
  4: "Higher Mathematics",
  5: "Physics",
  6: "Chemistry",
  7: "Biology",
};
const PHYSICS = 5;
const CHEMISTRY = 6;
const BIOLOGY = 7;

const toOption = (id: number) => ({ id, name: SUBJECT_NAMES[id] });

function makeSet(
  overrides: Partial<TutorRequirement> & Pick<TutorRequirement, "id" | "name">,
): TutorRequirement {
  return {
    isDefault: false,
    isActive: true,
    levelMin: 9,
    levelMax: 10,
    curricula: ["BANGLA_MEDIUM"],
    academicGroups: [],
    admissionTargets: [],
    timeFrom: "16:00",
    timeTo: "18:00",
    availableDays: 127,
    daysPerWeek: 3,
    minSalary: 8000,
    maxStudents: 1,
    availableFrom: "2026-11-01",
    teachesOnline: false,
    subjectIds: [PHYSICS],
    zoneIds: [],
    mappedPackageCount: 0,
    ...overrides,
  };
}

interface RecordedWrite {
  method: string;
  path: string;
  body: unknown;
}

/**
 * Stateful fake of the tutor API used by the dashboard, the requirement set pages and the
 * profile subject editor. Every non-GET request is recorded in `state.writes`.
 */
async function mockTutorApi(
  context: BrowserContext,
  seed: { sets: TutorRequirement[]; profileSubjectIds: number[] },
) {
  const state = {
    sets: seed.sets.map((s) => ({ ...s, subjectIds: [...s.subjectIds] })),
    profileSubjectIds: [...seed.profileSubjectIds],
    writes: [] as RecordedWrite[],
  };

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await context.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = req.method();
    const body = req.postDataJSON?.() ?? null;
    if (method !== "GET") state.writes.push({ method, path, body });

    if (path === "/me") {
      return json(route, {
        account: {
          id: "acc_1",
          role: "TUTOR",
          email: "test@example.com",
          status: "ACTIVE",
          createdAt: "2026-09-01T00:00:00.000Z",
          student: null,
          tutor: { ...tutorProfile, id: TUTOR_PROFILE_ID },
        },
      });
    }

    if (path === `/tutors/${TUTOR_PROFILE_ID}` && method === "GET") {
      return json(route, {
        tutor: {
          areas: [{ id: 1, name: "Dhanmondi" }],
          subjects: state.profileSubjectIds.map(toOption),
        },
      });
    }

    if (path === "/tutors/me/subjects" && method === "PUT") {
      const subjectIds = (body as { subjectIds: number[] }).subjectIds;
      state.profileSubjectIds = [...subjectIds];
      return json(route, { subjects: subjectIds.map(toOption) });
    }

    if (path === "/tutors/me/areas" && method === "PUT") {
      return json(route, { areas: [{ id: 1, name: "Dhanmondi" }] });
    }

    if (path === "/tutors/me/credentials") {
      return json(route, { credentials: [] });
    }
    if (path === "/tutors/me/videos") {
      return json(route, { videos: [] });
    }
    if (path === "/tutors/me/verifications") {
      return json(route, { verifications: [] });
    }

    if (path === "/lookups/education" && method === "GET") {
      return json(route, EDUCATION_LOOKUP);
    }

    if (path === "/tutors/me/requirements" && method === "GET") {
      const status = url.searchParams.get("status") ?? "all";
      const list = state.sets.filter((s) =>
        status === "all"
          ? true
          : status === "active"
            ? s.isActive
            : !s.isActive,
      );
      const sorted = [...list].sort(
        (a, b) => Number(b.isDefault) - Number(a.isDefault),
      );
      return json(route, { requirements: sorted });
    }

    if (path === "/tutors/me/requirements" && method === "POST") {
      const input = (body ?? {}) as Partial<TutorRequirement>;
      const created = makeSet({
        ...input,
        id: `set-new-${state.sets.length + 1}`,
        name: input.name ?? "",
        isActive: true,
        isDefault: false,
      });
      state.sets.push(created);
      return json(route, created, 201);
    }

    const match = path.match(
      /^\/tutors\/me\/requirements\/([^/]+)(?:\/(default|restore))?$/,
    );
    if (match) {
      const [, id, action] = match;
      const set = state.sets.find((s) => s.id === id);
      if (!set) return json(route, { message: "not found" }, 404);

      if (method === "GET" && !action) return json(route, set);

      if (method === "PATCH" && !action) {
        Object.assign(set, body);
        return json(route, set);
      }

      if (method === "DELETE" && !action) {
        set.isActive = false;
        return json(route, set);
      }

      if (method === "POST" && action === "restore") {
        set.isActive = true;
        return json(route, set);
      }

      if (method === "POST" && action === "default") {
        for (const s of state.sets) s.isDefault = s.id === id;
        return json(route, set);
      }
    }

    return json(route, { message: "not mocked" }, 404);
  });

  return state;
}

test.describe("Tutor requirement sets", () => {
  test.describe("Dashboard section", () => {
    test("shows one set, then three after View more, with a link to all sets", async ({
      page,
      context,
    }) => {
      await context.addCookies([sessionCookie("TUTOR")]);
      await mockTutorApi(context, {
        sets: Array.from({ length: 5 }, (_, i) =>
          makeSet({
            id: `set-${i + 1}`,
            name: `Set ${i + 1}`,
            isDefault: i === 0,
          }),
        ),
        profileSubjectIds: [PHYSICS],
      });

      await page.goto("/dashboard");

      const section = page.locator("#requirement-sets");
      await expect(section).toBeVisible();
      await expect(section.getByRole("listitem")).toHaveCount(1);

      await section.getByRole("button", { name: "View more" }).click();
      await expect(section.getByRole("listitem")).toHaveCount(3);

      await expect(
        section.getByRole("link", { name: "See all requirements" }),
      ).toHaveAttribute("href", "/dashboard/tutor/requirements");
    });
  });

  test.describe("Requirement sets page", () => {
    test("shows the active count", async ({ page, context }) => {
      await context.addCookies([sessionCookie("TUTOR")]);
      await mockTutorApi(context, {
        sets: Array.from({ length: 5 }, (_, i) =>
          makeSet({
            id: `set-${i + 1}`,
            name: `Set ${i + 1}`,
            isDefault: i === 0,
          }),
        ),
        profileSubjectIds: [PHYSICS],
      });

      await page.goto("/dashboard/tutor/requirements");
      await expect(
        page.getByText("5 of 10 active", { exact: true }),
      ).toBeVisible();
    });

    test("restores an archived set from the Archived tab", async ({
      page,
      context,
    }) => {
      await context.addCookies([sessionCookie("TUTOR")]);
      const state = await mockTutorApi(context, {
        sets: [
          makeSet({ id: "set-1", name: "Default Set", isDefault: true }),
          makeSet({ id: "set-2", name: "Set 2" }),
          makeSet({ id: "set-3", name: "Set 3" }),
          makeSet({ id: "set-4", name: "Set 4" }),
          makeSet({ id: "set-5", name: "Set 5" }),
          makeSet({
            id: "set-6",
            name: "Old Evening Set",
            isActive: false,
            subjectIds: [CHEMISTRY],
          }),
        ],
        profileSubjectIds: [PHYSICS, CHEMISTRY],
      });

      await page.goto("/dashboard/tutor/requirements");
      await expect(
        page.getByText("5 of 10 active", { exact: true }),
      ).toBeVisible();

      await page.getByRole("tab", { name: /Archived/ }).click();
      const archived = page.getByRole("listitem").filter({
        has: page.getByRole("heading", { name: "Old Evening Set" }),
      });
      await expect(archived).toBeVisible();
      await archived
        .getByRole("button", { name: "Restore", exact: true })
        .click();

      await expect(page.getByText("Set restored.")).toBeVisible();
      await expect(
        page.getByText("6 of 10 active", { exact: true }),
      ).toBeVisible();
      expect(
        state.writes.filter(
          (w) => w.path === "/tutors/me/requirements/set-6/restore",
        ),
      ).toHaveLength(1);
    });

    test("archiving a set offers Undo, which restores it", async ({
      page,
      context,
    }) => {
      await context.addCookies([sessionCookie("TUTOR")]);
      const state = await mockTutorApi(context, {
        sets: Array.from({ length: 5 }, (_, i) =>
          makeSet({
            id: `set-${i + 1}`,
            name: `Set ${i + 1}`,
            isDefault: i === 0,
          }),
        ),
        profileSubjectIds: [PHYSICS],
      });

      await page.goto("/dashboard/tutor/requirements");
      await expect(
        page.getByText("5 of 10 active", { exact: true }),
      ).toBeVisible();

      const target = page.getByRole("listitem").filter({
        has: page.getByRole("heading", { name: "Set 2", exact: true }),
      });
      await target
        .getByRole("button", { name: "Archive", exact: true })
        .click();

      await expect(page.getByText("Set archived.")).toBeVisible();
      await expect(
        page.getByText("4 of 10 active", { exact: true }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Undo", exact: true }).click();

      await expect(
        page.getByText("5 of 10 active", { exact: true }),
      ).toBeVisible();
      expect(
        state.writes.filter(
          (w) => w.path === "/tutors/me/requirements/set-2/restore",
        ),
      ).toHaveLength(1);
    });
  });

  test.describe("Create and edit", () => {
    test("creating a set with a subject that is not on the profile syncs it", async ({
      page,
      context,
    }) => {
      await context.addCookies([sessionCookie("TUTOR")]);
      const state = await mockTutorApi(context, {
        sets: [],
        profileSubjectIds: [PHYSICS],
      });

      await page.goto("/dashboard/tutor/requirements/new");
      await page
        .getByLabel("Set name", { exact: true })
        .fill("Evening Biology, Mirpur");

      // Biology is not on the profile, so it is added through the subject search.
      await page.getByLabel("Search subjects to add").fill("Biology");
      await page.getByRole("option", { name: "Biology", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Remove Biology" }),
      ).toBeVisible();
      await expect(
        page.getByText("Also adds Biology to your profile subjects.", {
          exact: true,
        }),
      ).toBeVisible();

      // Bangla Medium is already checked by default; add the Cambridge curriculum.
      await page
        .getByText("English Medium (Cambridge)", { exact: true })
        .click();
      await expect(
        page.getByRole("checkbox", { name: "English Medium (Cambridge)" }),
      ).toBeChecked();
      await page.getByLabel("From", { exact: true }).selectOption("9");
      await page.getByLabel("To", { exact: true }).selectOption("10");

      await page
        .getByRole("button", { name: "Create set", exact: true })
        .click();

      await page.waitForURL(
        (url) => url.pathname === "/dashboard/tutor/requirements",
      );
      const post = state.writes.find(
        (w) => w.method === "POST" && w.path === "/tutors/me/requirements",
      );
      expect(post).toBeDefined();
      expect(post?.body).toMatchObject({
        syncProfileSubjects: true,
        subjectIds: [BIOLOGY],
      });
    });

    test("saving an unchanged set sends no PATCH", async ({
      page,
      context,
    }) => {
      await context.addCookies([sessionCookie("TUTOR")]);
      const state = await mockTutorApi(context, {
        sets: [
          makeSet({
            id: "set-1",
            name: "Evening Physics",
            isDefault: true,
          }),
        ],
        profileSubjectIds: [PHYSICS],
      });

      await page.goto("/dashboard/tutor/requirements/set-1/edit");
      await expect(page.getByLabel("Set name", { exact: true })).toHaveValue(
        "Evening Physics",
      );

      await page
        .getByRole("button", { name: "Save changes", exact: true })
        .click();

      await expect(page.getByText("No changes to save.")).toBeVisible();
      expect(state.writes.filter((w) => w.method === "PATCH")).toHaveLength(0);
    });
  });

  test.describe("Removing a subject from the profile", () => {
    test("asks for confirmation, and Cancel keeps the section open without saving", async ({
      page,
      context,
    }) => {
      await context.addCookies([sessionCookie("TUTOR")]);
      const state = await mockTutorApi(context, {
        sets: [
          makeSet({
            id: "set-1",
            name: "Default Set",
            isDefault: true,
            subjectIds: [PHYSICS, CHEMISTRY],
          }),
        ],
        profileSubjectIds: [PHYSICS, CHEMISTRY],
      });

      await page.goto("/dashboard");
      const teaching = page.getByRole("region", { name: "Teaching" });
      await teaching.getByRole("button", { name: "Edit teaching" }).click();
      await teaching.getByRole("button", { name: "Remove Physics" }).click();
      await teaching
        .getByRole("button", { name: "Save changes", exact: true })
        .click();

      const dialog = page.getByRole("alertdialog", {
        name: "Remove from your sets too?",
      });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText("Physics will also be removed from 'Default Set'."),
      ).toBeVisible();

      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(
        teaching.getByRole("button", { name: "Save changes", exact: true }),
      ).toBeVisible();
      expect(
        state.writes.filter(
          (w) => w.method === "PUT" && w.path === "/tutors/me/subjects",
        ),
      ).toHaveLength(0);

      // Confirming the same removal saves it.
      await teaching
        .getByRole("button", { name: "Save changes", exact: true })
        .click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Remove", exact: true }).click();

      await expect(
        teaching.getByRole("button", { name: "Edit teaching" }),
      ).toBeVisible();
      const puts = state.writes.filter(
        (w) => w.method === "PUT" && w.path === "/tutors/me/subjects",
      );
      expect(puts).toHaveLength(1);
      expect(puts[0].body).toEqual({ subjectIds: [CHEMISTRY] });
    });

    test("is blocked when a set would be left with no subjects", async ({
      page,
      context,
    }) => {
      await context.addCookies([sessionCookie("TUTOR")]);
      const state = await mockTutorApi(context, {
        sets: [
          makeSet({
            id: "set-1",
            name: "Chemistry Only",
            isDefault: true,
            subjectIds: [CHEMISTRY],
          }),
          makeSet({
            id: "set-2",
            name: "Physics Only",
            subjectIds: [PHYSICS],
          }),
        ],
        profileSubjectIds: [PHYSICS, CHEMISTRY],
      });

      await page.goto("/dashboard");
      const teaching = page.getByRole("region", { name: "Teaching" });
      await teaching.getByRole("button", { name: "Edit teaching" }).click();
      await teaching.getByRole("button", { name: "Remove Physics" }).click();
      await teaching
        .getByRole("button", { name: "Save changes", exact: true })
        .click();

      const dialog = page.getByRole("alertdialog", {
        name: "Can't remove this subject yet",
      });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText("'Physics Only' would have no subjects left."),
      ).toBeVisible();
      await expect(
        dialog.getByRole("link", { name: "Edit 'Physics Only'" }),
      ).toHaveAttribute("href", "/dashboard/tutor/requirements/set-2/edit");

      expect(
        state.writes.filter(
          (w) => w.method === "PUT" && w.path === "/tutors/me/subjects",
        ),
      ).toHaveLength(0);
    });
  });
});
