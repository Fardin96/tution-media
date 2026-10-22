import type { BrowserContext, Page, Route } from "@playwright/test";

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

const base = {
  id: "p_1",
  address: "House 12, Road 4",
  emergencyContact: "+8801911111111",
  whatsappNumber: "+8801712345678",
  whatsappVerifiedAt: null,
  studentIdNumber: "NDC-2024-1187",
  verificationStatus: "NOT_SUBMITTED",
  ratingAvg: "0",
  ratingCount: 0,
  createdAt: "2026-09-01T00:00:00.000Z",
};

export const studentProfile = { ...base, name: "Rahim Uddin", areaId: 1 };
export const tutorProfile = {
  ...base,
  name: "Nusrat Jahan",
  gender: "FEMALE",
  parentsInfo: null,
  isListed: false,
};

/** Fakes the backend API and local Places proxy in the browser. Returns the recorded write requests. */
export async function mockApi(
  context: BrowserContext | Page,
  role: "STUDENT" | "TUTOR",
  opts: { onboarded: boolean },
) {
  let profile: Record<string, unknown> | null = opts.onboarded
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
          createdAt: base.createdAt,
          student: role === "STUDENT" ? profile : null,
          tutor: role === "TUTOR" ? profile : null,
        },
      });
    if (path === "/students/me" || path === "/tutors/me") {
      profile = { ...base, ...(profile ?? {}), ...req.postDataJSON() };
      return json(route, profile, method === "POST" ? 201 : 200);
    }
    if (path === "/tutors/me/areas") return json(route, { areas: [] });
    if (path === "/tutors/me/subjects") return json(route, { subjects: [] });
    if (path === "/tutors/me/credentials")
      return json(route, { credentials: [] });
    if (path === "/tutors/me/videos") return json(route, { videos: [] });
    if (path === "/tutors/me/verifications")
      return json(route, { verifications: [] });
    if (path.startsWith("/tutors/"))
      return json(route, {
        tutor: {
          areas: [{ id: 1, name: "Dhanmondi" }],
          subjects: [{ id: 5, name: "Physics" }],
        },
      });
    return json(route, { message: "not mocked" }, 404);
  });

  return writes;
}
