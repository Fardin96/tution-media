import type { BrowserContext, Route } from "@playwright/test";
import type { components } from "@/lib/api-types";

export { adminSessionCookie } from "./admin-mocks";

type Schemas = components["schemas"];
type Review = Schemas["AdminReview"];
type Report = Schemas["AdminReportDetail"];
type Dispute = Schemas["AdminDisputeDetail"];
type Party = Schemas["AdminParty"];

export interface Recorded {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}

const NOW = "2026-11-18T09:00:00.000Z";
const EARLIER = "2026-11-17T10:00:00.000Z";
const ADMIN_ID = "acc_admin";

const ME = {
  account: {
    id: ADMIN_ID,
    role: "ADMIN",
    email: "admin@example.com",
    status: "ACTIVE",
    consentVersion: null,
    consentAcceptedAt: null,
    createdAt: EARLIER,
    lastLoginAt: NOW,
    deletedAt: null,
    adminUser: {
      accountId: ADMIN_ID,
      role: "ADMIN",
      name: "Sabbir Ahmed",
      adminRole: "ADMIN",
      status: "ACTIVE",
      approvedById: null,
      approvedAt: EARLIER,
      removedById: null,
      removedAt: null,
      mfaEnabled: false,
      createdAt: EARLIER,
    },
  },
} satisfies Schemas["Me"];

const STUDENT_PARTY = {
  accountId: "acc_student",
  role: "STUDENT",
  status: "ACTIVE",
  name: "Rafi Hasan",
  email: "rafi@example.com",
} satisfies Party;

const TUTOR_PARTY = {
  accountId: "acc_tutor",
  role: "TUTOR",
  status: "ACTIVE",
  name: "Nusrat Jahan",
  email: "nusrat@example.com",
} satisfies Party;

const REVIEWS = [
  {
    id: "rv_1",
    direction: "STUDENT_TO_TUTOR",
    rating: 1,
    comment: "Shouted at my child and left early.",
    status: "VISIBLE",
    createdAt: EARLIER,
    updatedAt: EARLIER,
    tutor: { id: "t_1", accountId: "acc_tutor", name: "Nusrat Jahan" },
    student: { id: "s_1", accountId: "acc_student", name: "Rafi Hasan" },
  },
  {
    id: "rv_2",
    direction: "TUTOR_TO_STUDENT",
    rating: 5,
    comment: null,
    status: "VISIBLE",
    createdAt: EARLIER,
    updatedAt: EARLIER,
    tutor: { id: "t_1", accountId: "acc_tutor", name: "Nusrat Jahan" },
    student: { id: "s_1", accountId: "acc_student", name: "Rafi Hasan" },
  },
  {
    id: "rv_3",
    direction: "STUDENT_TO_TUTOR",
    rating: 2,
    comment: "Hidden earlier for abuse.",
    status: "HIDDEN",
    createdAt: EARLIER,
    updatedAt: EARLIER,
    tutor: { id: "t_2", accountId: "acc_tutor2", name: "Tanvir Hasan" },
    student: { id: "s_1", accountId: "acc_student", name: "Rafi Hasan" },
  },
] satisfies Review[];

const OPEN_REPORT = {
  id: "rep_1",
  category: "OFF_PLATFORM_CONTACT",
  details: "Asked me to pay by bKash directly.",
  status: "OPEN",
  createdAt: EARLIER,
  resolvedAt: null,
  resolutionNote: null,
  reporter: STUDENT_PARTY,
  target: TUTOR_PARTY,
  applicationId: "app_1",
  handledBy: null,
  targetOpenReports: 1,
  targetReportCount: 3,
  targetActiveBlock: null,
  application: { id: "app_1", status: "CONFIRMED", confirmedAt: EARLIER },
} satisfies Report;

const CLOSED_REPORT = {
  ...OPEN_REPORT,
  id: "rep_2",
  category: "SPAM",
  details: "Sent me the same ad four times.",
  status: "DISMISSED",
  resolvedAt: NOW,
  resolutionNote: "Not spam, a reminder.",
  handledBy: { accountId: "acc_other", name: "Tania Roy" },
} satisfies Report;

const OPEN_DISPUTE = {
  id: "dis_1",
  applicationId: "app_1",
  type: "PAYMENT",
  details: "Paid cash, tutor says nothing arrived.",
  status: "OPEN",
  createdAt: EARLIER,
  resolvedAt: null,
  resolutionNote: null,
  raisedBy: STUDENT_PARTY,
  against: TUTOR_PARTY,
  handledBy: null,
  application: {
    id: "app_1",
    status: "CONFIRMED",
    confirmedAt: EARLIER,
    endedAt: null,
    tutorId: "t_1",
    studentId: "s_1",
  },
  otherOpenDisputes: 0,
} satisfies Dispute;

const CLOSED_DISPUTE = {
  ...OPEN_DISPUTE,
  id: "dis_2",
  type: "SCHEDULE",
  details: "Tutor moved every lesson.",
  status: "RESOLVED",
  resolvedAt: NOW,
  resolutionNote: "Agreed a fixed slot with both.",
  handledBy: { accountId: "acc_other", name: "Tania Roy" },
} satisfies Dispute;

type Reply = { status: number; body: unknown };
const ok = (body: unknown, status = 200): Reply => ({ status, body });
const notFound = (what: string): Reply => ({
  status: 404,
  body: {
    error: "NotFound",
    code: "NOT_FOUND",
    message: `${what} not found`,
  } satisfies Schemas["ErrorResponse"],
});

const isOpen = (c: { status: string }) =>
  c.status === "OPEN" || c.status === "UNDER_REVIEW";

/**
 * Fakes the admin review, report and dispute endpoints. Keeps small in-memory state so a write
 * shows up in the next read, and records every request.
 */
export async function mockCasesApi(context: BrowserContext) {
  const reviews: Review[] = structuredClone(REVIEWS);
  const reports: Report[] = [
    structuredClone(OPEN_REPORT),
    structuredClone(CLOSED_REPORT),
  ];
  const disputes: Dispute[] = [
    structuredClone(OPEN_DISPUTE),
    structuredClone(CLOSED_DISPUTE),
  ];
  const writes: Recorded[] = [];
  const reads: Recorded[] = [];
  /** Requests with no fake behind them. A test that expects none asserts this list is empty. */
  const unmocked: string[] = [];

  function act(c: Report | Dispute, input: Schemas["CaseActionInput"]): Reply {
    if (!isOpen(c)) {
      return {
        status: 409,
        body: {
          error: "Conflict",
          code: "INVALID_CASE_STATE",
          message: "This case is already closed.",
        } satisfies Schemas["ErrorResponse"],
      };
    }
    if (input.action === "ASSIGN") {
      c.status = "UNDER_REVIEW";
      c.handledBy = { accountId: ADMIN_ID, name: "Sabbir Ahmed" };
    } else {
      c.status = input.action === "RESOLVE" ? "RESOLVED" : "DISMISSED";
      c.resolvedAt = NOW;
      c.resolutionNote = input.note ?? null;
      c.handledBy ??= { accountId: ADMIN_ID, name: "Sabbir Ahmed" };
    }
    return ok(c);
  }

  function queue<T extends { status: string }>(
    list: T[],
    params: URLSearchParams,
  ) {
    return params.get("queue") === "closed"
      ? list.filter((c) => !isOpen(c))
      : list.filter(isOpen);
  }

  function reply(
    method: string,
    path: string,
    params: URLSearchParams,
    body: unknown,
  ): Reply {
    if (method === "GET" && path === "/me") return ok(ME);

    if (method === "GET" && path === "/admin/reviews") {
      let list = reviews;
      const status = params.get("status");
      if (status) list = list.filter((r) => r.status === status);
      const rating = params.get("rating");
      if (rating) list = list.filter((r) => r.rating === Number(rating));
      const direction = params.get("direction");
      if (direction) list = list.filter((r) => r.direction === direction);
      return ok({
        reviews: list,
        nextCursor: null,
      } satisfies Schemas["AdminReviewPage"]);
    }
    const review = /^\/admin\/reviews\/([^/]+)$/.exec(path);
    if (review && method === "PATCH") {
      const found = reviews.find((r) => r.id === review[1]);
      if (!found) return notFound("Review");
      found.status = (body as Schemas["ModerateReviewInput"]).status;
      return ok(found);
    }

    if (method === "GET" && path === "/admin/reports") {
      let list = queue(reports, params);
      const category = params.get("category");
      if (category) list = list.filter((r) => r.category === category);
      return ok({
        reports: list,
        nextCursor: null,
      } satisfies Schemas["AdminReportPage"]);
    }
    const report = /^\/admin\/reports\/([^/]+)$/.exec(path);
    if (report) {
      const found = reports.find((r) => r.id === report[1]);
      if (!found) return notFound("Report");
      if (method === "GET") return ok(found);
      if (method === "PATCH") {
        return act(found, body as Schemas["CaseActionInput"]);
      }
    }

    if (method === "GET" && path === "/admin/disputes") {
      let list = queue(disputes, params);
      const type = params.get("type");
      if (type) list = list.filter((d) => d.type === type);
      return ok({
        disputes: list,
        nextCursor: null,
      } satisfies Schemas["AdminDisputePage"]);
    }
    const dispute = /^\/admin\/disputes\/([^/]+)$/.exec(path);
    if (dispute) {
      const found = disputes.find((d) => d.id === dispute[1]);
      if (!found) return notFound("Dispute");
      if (method === "GET") return ok(found);
      if (method === "PATCH") {
        return act(found, body as Schemas["CaseActionInput"]);
      }
    }

    return { status: 404, body: null };
  }

  await context.route("**/api/v1/**", async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/api/v1", "");
    const method = req.method();

    let result: Reply;
    if (method === "GET") {
      reads.push({ method, path, query: Object.fromEntries(url.searchParams) });
      result = reply(method, path, url.searchParams, undefined);
    } else {
      const body = req.postDataJSON?.() ?? null;
      writes.push({ method, path, body });
      result = reply(method, path, url.searchParams, body);
    }

    if (result.body === null) {
      unmocked.push(`${method} ${path}`);
      result = {
        status: 404,
        body: {
          error: "NotFound",
          code: "NOT_FOUND",
          message: "not mocked",
        } satisfies Schemas["ErrorResponse"],
      };
    }

    return route.fulfill({
      status: result.status,
      contentType: "application/json",
      body: JSON.stringify(result.body),
    });
  });

  return { writes, reads, unmocked };
}
