import type { BrowserContext, Page, Route } from "@playwright/test";
import type { components } from "@/lib/api-types";

type Schemas = components["schemas"];

// Same 14 subjects, in display order, as the static list they replace (ids match tuition-api/src/seed/index.ts).
export const subjectsMock = {
  subjects: [
    { id: 1, name: "Bangla", slug: "bangla" },
    { id: 2, name: "English", slug: "english" },
    { id: 3, name: "Mathematics", slug: "mathematics" },
    { id: 4, name: "Higher Mathematics", slug: "higher-mathematics" },
    { id: 5, name: "Physics", slug: "physics" },
    { id: 6, name: "Chemistry", slug: "chemistry" },
    { id: 7, name: "Biology", slug: "biology" },
    { id: 8, name: "ICT", slug: "ict" },
    { id: 9, name: "Accounting", slug: "accounting" },
    { id: 10, name: "Finance", slug: "finance" },
    { id: 11, name: "Economics", slug: "economics" },
    { id: 12, name: "General Science", slug: "general-science" },
    { id: 13, name: "Religion", slug: "religion" },
    { id: 14, name: "Arabic", slug: "arabic" },
  ],
} satisfies Schemas["SubjectList"];

export const sessionCookie = (role: "STUDENT" | "TUTOR") => ({
  name: "session",
  value: JSON.stringify({
    id: "acc_1",
    email: "test@example.com",
    name: "Test User",
    role,
  }),
  domain: "localhost",
  path: "/",
  httpOnly: true,
});

// Shared by both roles. Matches the MeStudent / MeTutor fields the API returns from GET /me.
const base = {
  id: "p_1",
  accountId: "acc_1",
  address: "House 12, Road 4",
  location: {
    lat: 23.7465,
    lng: 90.376,
    addressText: "House 12, Road 4",
    districtCode: "dhaka",
    placeId: null,
    needsReaddress: false,
  },
  emergencyContact: "+8801911111111",
  phoneNumber: "+8801811111111",
  phoneVerifiedAt: null,
  whatsappNumber: "+8801712345678",
  whatsappVerifiedAt: null,
  studentIdNumber: "NDC-2024-1187",
  verificationStatus: "NOT_SUBMITTED" as const,
  ratingAvg: "0",
  ratingCount: 0,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  needsReaddress: false,
};

export const studentProfile = {
  ...base,
  role: "STUDENT",
  name: "Rahim Uddin",
  areaId: 1,
  verificationFileId: null,
} satisfies Schemas["MeStudent"];

export const tutorProfile = {
  ...base,
  role: "TUTOR",
  name: "Nusrat Jahan",
  gender: "FEMALE",
  instituteName: "University of Dhaka",
  parentsInfo: null,
  zoneLimit: 5,
  isListed: false,
} satisfies Schemas["MeTutor"];

/** Fakes the backend API and local Places proxy in the browser. Returns the recorded write requests. */
export async function mockApi(
  context: BrowserContext | Page,
  role: "STUDENT" | "TUTOR",
  opts: { onboarded: boolean },
) {
  // Whichever profile the role has: seeded from the fixtures, then merged with each write.
  let profile: Schemas["MeStudent"] | Schemas["MeTutor"] | null = opts.onboarded
    ? { ...(role === "STUDENT" ? studentProfile : tutorProfile) }
    : null;
  const writes: { method: string; path: string; body: unknown }[] = [];
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

  await context.route("**/api/places/autocomplete", async (route) => {
    return json(route, { predictions: [] });
  });
  await context.route("**/api/places/details", async (route) => {
    return json(route, {
      formattedAddress: "Mock Address",
      location: { latitude: 23.7465, longitude: 90.376 },
      district: "Dhaka",
    });
  });

  await context.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/v1", "");
    const method = req.method();
    if (method !== "GET")
      writes.push({ method, path, body: req.postDataJSON?.() ?? null });

    if (path === "/me")
      return json(route, {
        account: {
          id: "acc_1",
          role,
          email: "test@example.com",
          status: "ACTIVE",
          consentVersion: null,
          consentAcceptedAt: null,
          createdAt: base.createdAt,
          lastLoginAt: null,
          deletedAt: null,
          adminUser: null,
          // The API omits the profile that does not apply, rather than sending null.
          student:
            (role === "STUDENT" && (profile as Schemas["MeStudent"] | null)) ||
            undefined,
          tutor:
            (role === "TUTOR" && (profile as Schemas["MeTutor"] | null)) ||
            undefined,
        } satisfies Schemas["MeAccount"],
      } satisfies Schemas["Me"]);
    if (path === "/students/me" || path === "/tutors/me") {
      profile = { ...base, ...(profile ?? {}), ...req.postDataJSON() };
      return json(route, profile, method === "POST" ? 201 : 200);
    }
    if (path === "/subjects") return json(route, subjectsMock);
    if (path === "/tutors/me/areas")
      return json(route, { areas: [] } satisfies Schemas["TutorAreas"]);
    if (path === "/tutors/me/subjects")
      return json(route, { subjects: [] } satisfies Schemas["TutorSubjects"]);
    if (path === "/tutors/me/credentials")
      return json(route, {
        credentials: [],
      } satisfies Schemas["TutorCredentialList"]);
    if (path === "/tutors/me/videos")
      return json(route, { videos: [] } satisfies Schemas["TutorVideoList"]);
    if (path === "/tutors/me/verifications")
      return json(route, {
        verifications: [],
      } satisfies Schemas["TutorVerificationList"]);
    if (path.startsWith("/tutors/"))
      // Also answers other /tutors/... subpaths, so the body is a public profile for all of them.
      return json(route, {
        tutor: {
          id: "p_1",
          name: "Nusrat Jahan",
          gender: "FEMALE",
          instituteName: "University of Dhaka",
          ratingAvg: 0,
          ratingCount: 0,
          verificationStatus: "NOT_SUBMITTED",
          isListed: false,
          needsReaddress: false,
          createdAt: base.createdAt,
          updatedAt: base.updatedAt,
          areas: [{ id: 1, name: "Dhanmondi" }],
          subjects: [{ id: 5, name: "Physics" }],
          credentials: [],
          videos: [],
        },
      } satisfies Schemas["TutorPublicProfileResult"]);
    return json(
      route,
      {
        error: "NotFound",
        code: "NOT_FOUND",
        message: "not mocked",
      } satisfies Schemas["ErrorResponse"],
      404,
    );
  });

  return writes;
}
