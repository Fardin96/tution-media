import type { BrowserContext, Route } from "@playwright/test";
import type { components } from "@/lib/api-types";

type Schemas = components["schemas"];
type Payment = Schemas["AdminPaymentAttemptDetail"];
type Promo = Schemas["AdminPromoCodeDetail"];
type Refund = Schemas["AdminRefundDetail"];
type Setting = Schemas["PlatformSettingItem"];

export type AdminRole = Schemas["MeAdminUser"]["adminRole"];

export interface AdminMockOptions {
  adminRole: AdminRole;
  /** The gateway's answer when a refund is approved. NEEDS_REVIEW means it didn't answer clearly. */
  approveOutcome?: "PROCESSING" | "NEEDS_REVIEW";
}

/** One request the page made. Writes are every non-GET call, reads are GET calls. */
export interface Recorded {
  method: string;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
}

const ADMIN_NAME = "Sabbir Ahmed";
const NOW = "2026-11-18T09:00:00.000Z";
const EARLIER = "2026-11-17T10:00:00.000Z";
const TUTOR = { id: "t_1", name: "Nusrat Jahan" };
const OTHER_TUTOR = { id: "t_2", name: "Tanvir Hasan" };

/** The session cookie only says ADMIN for both admin roles. Super-admin rights come from GET /me. */
export const adminSessionCookie = {
  name: "session",
  value: JSON.stringify({
    id: "acc_admin",
    email: "admin@example.com",
    name: ADMIN_NAME,
    role: "ADMIN",
  }),
  domain: "localhost",
  path: "/",
  httpOnly: true,
};

function adminMe(adminRole: AdminRole) {
  return {
    account: {
      id: "acc_admin",
      role: "ADMIN",
      email: "admin@example.com",
      avatarUrl: null,
      status: "ACTIVE",
      consentVersion: null,
      consentAcceptedAt: null,
      createdAt: EARLIER,
      lastLoginAt: NOW,
      deletedAt: null,
      adminUser: {
        accountId: "acc_admin",
        role: "ADMIN",
        name: ADMIN_NAME,
        adminRole,
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
}

const FEE_DUE = {
  id: "fee_1",
  status: "DUE",
  amountDue: "1500.00",
  amountPaid: "0.00",
} as const;

const FEE_PAID = {
  id: "fee_2",
  status: "PAID",
  amountDue: "1350.00",
  amountPaid: "1350.00",
} as const;

/** The gateway says paid, but the amount doesn't match the fee. A super admin decides. */
const REVIEW_PAYMENT = {
  id: "pay_review",
  tranId: "SSL-REVIEW-1001",
  status: "REVIEW",
  feeAmount: "1500.00",
  chargeAmount: "37.50",
  totalAmount: "1537.50",
  failureReason: "The gateway paid 1537.50, which doesn't match the fee.",
  valId: "VAL-REVIEW-1001",
  bankTranId: "BANK-REVIEW-1001",
  cardType: "VISA-Dutch-Bangla",
  riskLevel: 0,
  paymentId: null,
  createdAt: EARLIER,
  updatedAt: EARLIER,
  lastCheckedAt: EARLIER,
  settledAt: null,
  fee: FEE_DUE,
  tutor: TUTOR,
  gatewayResponse: {
    status: "VALID",
    tran_id: "SSL-REVIEW-1001",
    amount: "1537.50",
  },
  canCheck: true,
  canReview: true,
  refundable: "0.00",
  refunds: [],
} satisfies Payment;

/** A payment that went through and can be refunded. */
const PAID_PAYMENT = {
  id: "pay_paid",
  tranId: "SSL-PAID-2002",
  status: "SUCCEEDED",
  feeAmount: "1350.00",
  chargeAmount: "33.75",
  totalAmount: "1383.75",
  failureReason: null,
  valId: "VAL-PAID-2002",
  bankTranId: "BANK-PAID-2002",
  cardType: "BKASH",
  riskLevel: 0,
  paymentId: "ledger_1",
  createdAt: EARLIER,
  updatedAt: EARLIER,
  lastCheckedAt: null,
  settledAt: EARLIER,
  fee: FEE_PAID,
  tutor: TUTOR,
  gatewayResponse: null,
  canCheck: false,
  canReview: false,
  refundable: "1350.00",
  refunds: [],
} satisfies Payment;

const RAMADAN_CODE = {
  id: "promo_1",
  code: "RAMADAN15",
  description: "Ramadan offer",
  discountType: "PERCENT",
  discountValue: "15.00",
  maxDiscount: "300.00",
  startsAt: null,
  endsAt: null,
  maxRedemptions: 100,
  maxPerTutor: 1,
  isActive: true,
  redemptionCount: 3,
  createdAt: EARLIER,
  updatedAt: EARLIER,
  createdByName: ADMIN_NAME,
  redemptions: [
    {
      id: "red_1",
      feeId: "fee_1",
      tutor: TUTOR,
      originalAmount: "1500.00",
      discountAmount: "225.00",
      status: "ACTIVE",
      createdAt: EARLIER,
      releasedAt: null,
      releaseReason: null,
    },
  ],
} satisfies Promo;

const OLD_CODE = {
  id: "promo_2",
  code: "OLDCODE",
  description: null,
  discountType: "FLAT",
  discountValue: "200.00",
  maxDiscount: null,
  startsAt: null,
  endsAt: null,
  maxRedemptions: null,
  maxPerTutor: 1,
  isActive: false,
  redemptionCount: 0,
  createdAt: EARLIER,
  updatedAt: EARLIER,
  createdByName: ADMIN_NAME,
  redemptions: [],
} satisfies Promo;

/** A tutor's request for the paid payment above. A super admin approves or declines it. */
const TUTOR_REFUND = {
  id: "rf_1",
  status: "REQUESTED",
  source: "TUTOR",
  amount: "1350.00",
  reason: "Classes stopped after the second week.",
  refundRefId: null,
  failureReason: null,
  decisionNote: null,
  createdAt: EARLIER,
  updatedAt: EARLIER,
  decidedAt: null,
  completedAt: null,
  lastCheckedAt: null,
  attempt: {
    tranId: "SSL-PAID-2002",
    status: "SUCCEEDED",
    feeAmount: "1350.00",
    totalAmount: "1383.75",
    bankTranId: "BANK-PAID-2002",
  },
  fee: FEE_PAID,
  tutor: TUTOR,
  requestedByName: TUTOR.name,
  decidedByName: null,
  reversalId: null,
  gatewayResponse: null,
  canApprove: true,
  canReject: true,
  canCheck: false,
  canResolve: false,
} satisfies Refund;

/** An older refund that already went through. Only the All view shows it. */
const OLD_REFUND = {
  id: "rf_2",
  status: "SUCCEEDED",
  source: "ADMIN",
  amount: "200.00",
  reason: "Charged twice",
  refundRefId: "REF-OLD-1",
  failureReason: null,
  decisionNote: "Confirmed in the merchant panel",
  createdAt: EARLIER,
  updatedAt: EARLIER,
  decidedAt: EARLIER,
  completedAt: EARLIER,
  lastCheckedAt: null,
  attempt: {
    tranId: "SSL-OLD-1500",
    status: "SUCCEEDED",
    feeAmount: "200.00",
    totalAmount: "206.00",
    bankTranId: "BANK-OLD-1500",
  },
  fee: { id: "fee_3", status: "DUE", amountDue: "200.00", amountPaid: "0.00" },
  tutor: OTHER_TUTOR,
  requestedByName: ADMIN_NAME,
  decidedByName: ADMIN_NAME,
  reversalId: "rev_old",
  gatewayResponse: null,
  canApprove: false,
  canReject: false,
  canCheck: false,
  canResolve: false,
} satisfies Refund;

const SETTINGS = [
  {
    key: "commission_percent",
    value: 10,
    updatedAt: null,
    updatedByName: null,
  },
  {
    key: "online_payments_enabled",
    value: true,
    updatedAt: null,
    updatedByName: null,
  },
  {
    key: "gateway_charge_percent",
    value: 2.5,
    updatedAt: null,
    updatedByName: null,
  },
  {
    key: "refund_window_days",
    value: 7,
    updatedAt: null,
    updatedByName: null,
  },
  {
    key: "require_tutor_verification",
    value: true,
    updatedAt: null,
    updatedByName: null,
  },
  {
    key: "require_tutor_phone_verification",
    value: true,
    updatedAt: null,
    updatedByName: null,
  },
  {
    key: "require_student_phone_verification",
    value: true,
    updatedAt: null,
    updatedByName: null,
  },
] satisfies Setting[];

type Layout = Schemas["AdminDashboardLayout"];
type Catalog = Layout["catalog"];
type WidgetId = Catalog[number]["id"];
type WidgetKind = Catalog[number]["kind"];
type WidgetBody = Schemas["AdminDashboardWidget"];

/** The saved list a new session starts with: the defaultOn items, in registry order. */
const DASHBOARD_DEFAULTS: WidgetId[] = [
  "bottleneck",
  "queues",
  "mau",
  "signups",
  "collected",
  "placements",
  "signups-trend",
  "revenue-trend",
];

/** All 15 widgets, copied from tuition-api/src/modules/admin/dashboard-registry.ts. */
const DASHBOARD_CATALOG = [
  {
    id: "bottleneck",
    title: "Where it's stuck",
    description:
      "Each step from sign-up to a paid placement, and where people drop off.",
    definition:
      "Cohorts that entered in the selected range. Conversion is the share of the step before. Wait is the median days from the step before. A step is flagged when, over the last 30 days against the 30 before, conversion fell 5 points or more or the wait grew 25% or more, with at least 30 people in both periods. Only people old enough to have had a chance count toward a flag. A step counts people who reached the steps it depends on. Tutors can apply and students can hire through a package without the step before. Waived fees count as settled; void fees are left out.",
    group: "pipeline",
    kind: "funnel",
    span: 12,
    keywords: [
      "bottleneck",
      "funnel",
      "stuck",
      "drop-off",
      "conversion",
      "pipeline",
      "placement",
    ],
    href: null,
    defaultOn: true,
  },
  {
    id: "queues",
    title: "Needs attention",
    description: "Work waiting on an admin, oldest first.",
    definition:
      "Items waiting for an admin right now. Late means the oldest item has waited past its target time; watch means it is past half of it.",
    group: "operations",
    kind: "queue",
    span: 12,
    keywords: [
      "queue",
      "backlog",
      "pending",
      "review",
      "attention",
      "sla",
      "todo",
    ],
    href: null,
    defaultOn: true,
  },
  {
    id: "mau",
    title: "Monthly active users",
    description: "Students and tutors who used the app in the last 30 days.",
    definition:
      "Accounts (not admins) that signed in or kept a session alive on any day in the last 30 days, whatever range is selected. History starts with the oldest session still stored. Blocked and deactivated accounts are left out.",
    group: "people",
    kind: "kpi",
    span: 3,
    keywords: ["mau", "active", "users", "engagement", "monthly"],
    href: "/dashboard/admin/accounts",
    defaultOn: true,
  },
  {
    id: "signups",
    title: "Sign-ups",
    description: "New student and tutor accounts.",
    definition:
      "Student and tutor accounts created in the range, deactivated ones included.",
    group: "people",
    kind: "kpi",
    span: 3,
    keywords: ["signups", "registrations", "new users", "growth", "accounts"],
    href: "/dashboard/admin/accounts",
    defaultOn: true,
  },
  {
    id: "collected",
    title: "Fees collected",
    description: "Placement fees received, after refunds.",
    definition:
      "Fee payments received in the range (online and cash) minus reversals in the range. A completed refund is recorded as a reversal. The SSLCommerz processing charge is not included.",
    group: "money",
    kind: "kpi",
    span: 3,
    keywords: [
      "revenue",
      "payments",
      "collected",
      "money",
      "fees",
      "income",
      "monthly payments",
    ],
    href: "/dashboard/admin/fees",
    defaultOn: true,
  },
  {
    id: "placements",
    title: "Placements",
    description: "Tutors hired, from requirements and packages.",
    definition:
      "Applications confirmed in the range, from requirements and from package requests.",
    group: "pipeline",
    kind: "kpi",
    span: 3,
    keywords: ["placements", "hires", "matches", "confirmed"],
    href: "/dashboard/admin/applications",
    defaultOn: true,
  },
  {
    id: "signups-trend",
    title: "Sign-ups over time",
    description: "New students and tutors per day or month.",
    definition:
      "Student and tutor accounts created per Dhaka day (per month for 12 months).",
    group: "people",
    kind: "series",
    span: 6,
    keywords: ["signups", "growth", "trend", "registrations", "chart"],
    href: "/dashboard/admin/accounts",
    defaultOn: true,
  },
  {
    id: "revenue-trend",
    title: "Fees over time",
    description: "Fees collected and refunded per day or month.",
    definition:
      "Fee payments received and reversals (refunds included) per Dhaka day (per month for 12 months). Processing charges are not included.",
    group: "money",
    kind: "series",
    span: 6,
    keywords: [
      "revenue",
      "payments",
      "refunds",
      "money",
      "trend",
      "chart",
      "monthly payments",
    ],
    href: "/dashboard/admin/payments",
    defaultOn: true,
  },
  {
    id: "fill-rate",
    title: "Fill rate",
    description: "Share of requirements that hired a tutor.",
    definition:
      "Requirements posted in the range (drafts excluded) that have a confirmed application so far. Recent requirements may still fill.",
    group: "pipeline",
    kind: "kpi",
    span: 3,
    keywords: ["fill rate", "hired", "requirements", "conversion", "liquidity"],
    href: "/dashboard/admin/matching",
    defaultOn: false,
  },
  {
    id: "time-to-hire",
    title: "Time to hire",
    description: "Days from posting a requirement to hiring a tutor.",
    definition:
      "Median days from posting to the confirmed application, for hires confirmed in the range.",
    group: "pipeline",
    kind: "kpi",
    span: 3,
    keywords: ["time to hire", "speed", "days", "wait", "latency"],
    href: "/dashboard/admin/matching",
    defaultOn: false,
  },
  {
    id: "collection-rate",
    title: "Collection rate",
    description: "Share of fees raised in the range that are paid.",
    definition:
      "Amount paid over amount due, for fees created in the range. Waived and void fees are left out.",
    group: "money",
    kind: "kpi",
    span: 3,
    keywords: ["collection", "paid", "take rate", "fees", "money"],
    href: "/dashboard/admin/fees",
    defaultOn: false,
  },
  {
    id: "overdue-fees",
    title: "Overdue fees",
    description: "Unpaid fees past their due date, by age.",
    definition:
      "Amount still owed on fees that are due or part paid and past their due date now, grouped by days overdue. The range does not apply.",
    group: "money",
    kind: "donut",
    span: 6,
    keywords: ["overdue", "unpaid", "debt", "fees", "late", "ageing"],
    href: "/dashboard/admin/fees",
    defaultOn: false,
  },
  {
    id: "payment-health",
    title: "Online payment results",
    description: "How SSLCommerz payment attempts ended.",
    definition:
      "Online payment attempts started in the range, by result. Success rate is succeeded over all attempts that finished.",
    group: "money",
    kind: "donut",
    span: 6,
    keywords: [
      "payments",
      "gateway",
      "sslcommerz",
      "failed",
      "success rate",
      "checkout",
    ],
    href: "/dashboard/admin/payments",
    defaultOn: false,
  },
  {
    id: "trust-cases",
    title: "Reports and disputes",
    description: "Cases opened and closed per day or month.",
    definition:
      "Reports and disputes opened, and closed (resolved or dismissed), per Dhaka day (per month for 12 months).",
    group: "trust",
    kind: "series",
    span: 6,
    keywords: ["reports", "disputes", "trust", "safety", "cases", "complaints"],
    href: "/dashboard/admin/reports",
    defaultOn: false,
  },
  {
    id: "activity-trend",
    title: "Daily active users",
    description: "Students and tutors active each day.",
    definition:
      "Accounts (not admins) that signed in or kept a session alive each Dhaka day (monthly actives for 12 months). Blocked and deactivated accounts are left out.",
    group: "people",
    kind: "series",
    span: 6,
    keywords: ["dau", "active", "daily", "engagement", "usage", "trend"],
    href: "/dashboard/admin/accounts",
    defaultOn: false,
  },
] satisfies Catalog;

/*
 * One payload per widget kind. The handler copies the requested widget's id and range onto it.
 */
const KPI_WIDGET = {
  id: "mau",
  range: "30d",
  generatedAt: NOW,
  data: {
    kind: "kpi",
    format: "count",
    value: 1284,
    previous: 1190,
    higherIsBetter: true,
    spark: [
      { date: "2026-11-16", values: { value: 1190 } },
      { date: "2026-11-17", values: { value: 1210 } },
      { date: "2026-11-18", values: { value: 1248 } },
      { date: "2026-11-19", values: { value: 1284 } },
    ],
    breakdown: [
      { label: "Students", value: 960 },
      { label: "Tutors", value: 324 },
    ],
    note: null,
  },
} satisfies WidgetBody;

const SERIES_WIDGET = {
  id: "signups-trend",
  range: "30d",
  generatedAt: NOW,
  data: {
    kind: "series",
    chart: "area",
    format: "count",
    series: [
      { key: "students", label: "Students", color: "chart-1" },
      { key: "tutors", label: "Tutors", color: "chart-2" },
    ],
    points: [
      { date: "2026-11-16", values: { students: 12, tutors: 4 } },
      { date: "2026-11-17", values: { students: 9, tutors: 3 } },
      { date: "2026-11-18", values: { students: 15, tutors: 6 } },
      { date: "2026-11-19", values: { students: 12, tutors: 4 } },
    ],
    totals: { students: 48, tutors: 17 },
    note: null,
  },
} satisfies WidgetBody;

/** "Where it's stuck": one flagged stage, shown in the strip above the tabs. */
const FUNNEL_WIDGET = {
  id: "bottleneck",
  range: "30d",
  generatedAt: NOW,
  data: {
    kind: "funnel",
    funnels: [
      {
        key: "placement",
        label: "Placement",
        stages: [
          {
            key: "signup",
            label: "Signed up",
            count: 420,
            conversion: null,
            medianDays: null,
            flagged: false,
            flagReason: null,
          },
          {
            key: "applied",
            label: "Applied",
            count: 260,
            conversion: 0.62,
            medianDays: 1.2,
            flagged: false,
            flagReason: null,
          },
          {
            key: "hired",
            label: "Hired",
            count: 98,
            conversion: 0.38,
            medianDays: 6.5,
            flagged: true,
            flagReason: "38%, down 7 pts on the previous 30 days",
          },
          {
            key: "paid",
            label: "Paid",
            count: 90,
            conversion: 0.92,
            medianDays: 2,
            flagged: false,
            flagReason: null,
          },
        ],
      },
    ],
  },
} satisfies WidgetBody;

/** "Needs attention": one late row, one watch row and one empty queue. */
const QUEUE_WIDGET = {
  id: "queues",
  range: "30d",
  generatedAt: NOW,
  data: {
    kind: "queue",
    rows: [
      {
        key: "payments",
        label: "Payments to review",
        count: 3,
        oldestHours: 50,
        status: "late",
        href: "/dashboard/admin/payments",
      },
      {
        key: "refunds",
        label: "Refund requests",
        count: 2,
        oldestHours: 5,
        status: "watch",
        href: "/dashboard/admin/refunds",
      },
      {
        key: "verifications",
        label: "ID checks",
        count: 0,
        oldestHours: null,
        status: "ok",
        href: "/dashboard/admin/verifications",
      },
    ],
  },
} satisfies WidgetBody;

const DONUT_WIDGET = {
  id: "payment-health",
  range: "30d",
  generatedAt: NOW,
  data: {
    kind: "donut",
    format: "count",
    slices: [
      { key: "succeeded", label: "Succeeded", value: 42, color: "good" },
      { key: "failed", label: "Failed", value: 6, color: "bad" },
      { key: "pending", label: "Pending", value: 3, color: "warn" },
    ],
    center: { label: "Success rate", value: 0.84, format: "percent" },
    note: null,
  },
} satisfies WidgetBody;

const PAYLOAD_BY_KIND: Record<WidgetKind, WidgetBody> = {
  kpi: KPI_WIDGET,
  series: SERIES_WIDGET,
  funnel: FUNNEL_WIDGET,
  queue: QUEUE_WIDGET,
  donut: DONUT_WIDGET,
};

/** Refund status flags, as the API reports them for any admin. The UI decides who may press them. */
function refundFlags(status: Refund["status"]) {
  return {
    canApprove: status === "REQUESTED",
    canReject: status === "REQUESTED",
    canCheck: status === "PROCESSING" || status === "NEEDS_REVIEW",
    canResolve: status === "NEEDS_REVIEW",
  };
}

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

const conflict = (code: Schemas["ErrorResponse"]["code"], message: string) => ({
  status: 409,
  body: {
    error: "Conflict",
    code,
    message,
  } satisfies Schemas["ErrorResponse"],
});

/**
 * Fakes the admin endpoints the payments, promo-code, refund and settings pages call. Keeps
 * small in-memory state so a write shows up in the next read, and records every request.
 */
export async function mockAdminApi(
  context: BrowserContext,
  options: AdminMockOptions,
) {
  const me = adminMe(options.adminRole);
  const payments: Payment[] = [
    structuredClone(REVIEW_PAYMENT),
    structuredClone(PAID_PAYMENT),
  ];
  const promos: Promo[] = [
    structuredClone(RAMADAN_CODE),
    structuredClone(OLD_CODE),
  ];
  const refunds: Refund[] = [
    structuredClone(TUTOR_REFUND),
    structuredClone(OLD_REFUND),
  ];
  const settings: Setting[] = structuredClone(SETTINGS);
  let nextPromo = 3;
  let nextRefund = 3;
  /** The saved dashboard list for this session. PUT stores it, DELETE resets it. */
  let dashboardWidgets: WidgetId[] = [...DASHBOARD_DEFAULTS];
  const dashboardLayout = () =>
    ({
      catalog: DASHBOARD_CATALOG,
      widgets: dashboardWidgets,
      isDefault:
        JSON.stringify(dashboardWidgets) === JSON.stringify(DASHBOARD_DEFAULTS),
      updatedAt:
        JSON.stringify(dashboardWidgets) === JSON.stringify(DASHBOARD_DEFAULTS)
          ? null
          : NOW,
    }) satisfies Layout;

  const writes: Recorded[] = [];
  const reads: Recorded[] = [];
  /** Requests with no fake behind them. A test that expects none asserts this list is empty. */
  const unmocked: string[] = [];

  const findPayment = (tranId: string) =>
    payments.find((p) => p.tranId === tranId);
  const findPromo = (id: string) => promos.find((p) => p.id === id);
  const findRefund = (id: string) => refunds.find((r) => r.id === id);

  function reviewPayment(payment: Payment, decision: "APPROVE" | "REJECT") {
    if (decision === "APPROVE") {
      Object.assign(payment, {
        status: "SUCCEEDED",
        settledAt: NOW,
        paymentId: "ledger_2",
        refundable: payment.feeAmount,
        fee: FEE_PAID,
      });
    } else {
      Object.assign(payment, {
        status: "UNAPPLIED",
        refundable: payment.totalAmount,
      });
    }
    Object.assign(payment, {
      canReview: false,
      canCheck: payment.status === "UNAPPLIED",
    });
    return payment;
  }

  function reply(
    method: string,
    path: string,
    params: URLSearchParams,
    body: unknown,
  ): Reply {
    if (method === "GET" && path === "/me") return ok(me);

    // Payment attempts
    if (method === "GET" && path === "/admin/payment-attempts/summary") {
      return ok({
        review: payments.filter((p) => p.status === "REVIEW").length,
        unapplied: payments.filter((p) => p.status === "UNAPPLIED").length,
        stalePending: 2,
        succeeded24h: 3,
        collected24h: "4500.00",
      } satisfies Schemas["AdminPaymentSummary"]);
    }
    if (method === "GET" && path === "/admin/payment-attempts") {
      let list = payments;
      if (params.get("attention") === "true") {
        list = list.filter(
          (p) => p.status === "REVIEW" || p.status === "UNAPPLIED",
        );
      }
      const status = params.get("status");
      if (status) list = list.filter((p) => p.status === status);
      return ok({
        attempts: list,
        nextCursor: null,
      } satisfies Schemas["AdminPaymentAttemptPage"]);
    }
    const payment =
      /^\/admin\/payment-attempts\/([^/]+)(\/check|\/review)?$/.exec(path);
    if (payment) {
      const found = findPayment(decodeURIComponent(payment[1]));
      if (!found) return notFound("Payment");
      if (!payment[2] && method === "GET") return ok(found);
      if (payment[2] === "/check" && method === "POST") return ok(found);
      if (payment[2] === "/review" && method === "POST") {
        const input = body as Schemas["ReviewPaymentInput"];
        return ok(reviewPayment(found, input.decision));
      }
    }

    // Promo codes
    if (method === "GET" && path === "/admin/promo-codes") {
      let list = promos;
      const active = params.get("active");
      if (active !== null) {
        list = list.filter((p) => p.isActive === (active === "true"));
      }
      return ok({
        promoCodes: list,
        nextCursor: null,
      } satisfies Schemas["AdminPromoCodePage"]);
    }
    if (method === "POST" && path === "/admin/promo-codes") {
      const input = body as Schemas["CreatePromoCodeInput"];
      const code = input.code.toUpperCase();
      if (promos.some((p) => p.code === code)) {
        return conflict(
          "PROMO_CODE_EXISTS",
          "A promo code with that name already exists.",
        );
      }
      const created: Promo = {
        id: `promo_${nextPromo++}`,
        code,
        description: input.description ?? null,
        discountType: input.discountType,
        discountValue: input.discountValue.toFixed(2),
        maxDiscount: input.maxDiscount?.toFixed(2) ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        maxRedemptions: input.maxRedemptions ?? null,
        maxPerTutor: input.maxPerTutor ?? 1,
        isActive: true,
        redemptionCount: 0,
        createdAt: NOW,
        updatedAt: NOW,
        createdByName: ADMIN_NAME,
        redemptions: [],
      };
      promos.push(created);
      return ok(created, 201);
    }
    const promoMatch = /^\/admin\/promo-codes\/([^/]+)$/.exec(path);
    if (promoMatch) {
      const promo = findPromo(decodeURIComponent(promoMatch[1]));
      if (!promo) return notFound("Promo code");
      if (method === "GET") return ok(promo);
      if (method === "PATCH") {
        const input = body as Schemas["UpdatePromoCodeInput"];
        Object.assign(promo, input, { updatedAt: NOW });
        return ok(promo);
      }
    }

    // Refunds
    if (method === "GET" && path === "/admin/refunds") {
      let list = refunds;
      if (params.get("open") === "true") {
        list = list.filter(
          (r) =>
            r.status === "REQUESTED" ||
            r.status === "PROCESSING" ||
            r.status === "NEEDS_REVIEW",
        );
      }
      const status = params.get("status");
      if (status) list = list.filter((r) => r.status === status);
      return ok({
        refunds: list,
        nextCursor: null,
      } satisfies Schemas["AdminRefundPage"]);
    }
    if (method === "POST" && path === "/admin/refunds") {
      const input = body as Schemas["CreateRefundInput"];
      const source = findPayment(input.tranId);
      if (!source) return notFound("Payment");
      const created: Refund = {
        id: `rf_${nextRefund++}`,
        status: "PROCESSING",
        source: "ADMIN",
        amount: input.amount ?? source.refundable,
        reason: input.reason,
        refundRefId: "REF-NEW-1",
        failureReason: null,
        decisionNote: null,
        createdAt: NOW,
        updatedAt: NOW,
        decidedAt: NOW,
        completedAt: null,
        lastCheckedAt: null,
        attempt: {
          tranId: source.tranId,
          status: source.status,
          feeAmount: source.feeAmount,
          totalAmount: source.totalAmount,
          bankTranId: source.bankTranId,
        },
        fee: source.fee,
        tutor: source.tutor,
        requestedByName: ADMIN_NAME,
        decidedByName: ADMIN_NAME,
        reversalId: null,
        gatewayResponse: null,
        ...refundFlags("PROCESSING"),
      };
      refunds.push(created);
      return ok(created, 201);
    }
    const refundMatch =
      /^\/admin\/refunds\/([^/]+)(\/approve|\/reject|\/check|\/resolve)?$/.exec(
        path,
      );
    if (refundMatch) {
      const refund = findRefund(decodeURIComponent(refundMatch[1]));
      if (!refund) return notFound("Refund");
      const action = refundMatch[2];
      if (!action && method === "GET") return ok(refund);
      if (action === "/check" && method === "POST") return ok(refund);
      if (action === "/approve" && method === "POST") {
        if (refund.status !== "REQUESTED") {
          return conflict(
            "INVALID_REFUND_STATE",
            "Only a requested refund can be approved.",
          );
        }
        const status = options.approveOutcome ?? "PROCESSING";
        Object.assign(refund, {
          status,
          decidedAt: NOW,
          decidedByName: ADMIN_NAME,
          decisionNote: (body as Schemas["ApproveRefundInput"] | null)?.note,
          refundRefId: "REF-NEW-2",
          ...refundFlags(status),
        });
        return ok(refund);
      }
      if (action === "/reject" && method === "POST") {
        const input = body as Schemas["RejectRefundInput"];
        Object.assign(refund, {
          status: "REJECTED",
          decidedAt: NOW,
          decidedByName: ADMIN_NAME,
          decisionNote: input.note,
          ...refundFlags("REJECTED"),
        });
        return ok(refund);
      }
      if (action === "/resolve" && method === "POST") {
        const input = body as Schemas["ResolveRefundInput"];
        Object.assign(refund, {
          status: input.outcome,
          completedAt: NOW,
          refundRefId: input.refundRefId ?? refund.refundRefId,
          decisionNote: input.note,
          reversalId: input.outcome === "SUCCEEDED" ? "rev_new" : null,
          ...refundFlags(input.outcome),
        });
        return ok(refund);
      }
    }

    // Business dashboard
    if (method === "GET" && path === "/admin/dashboard/layout") {
      return ok(dashboardLayout());
    }
    if (method === "PUT" && path === "/admin/dashboard/layout") {
      const input = body as Schemas["SaveAdminDashboardLayoutInput"];
      dashboardWidgets = [...input.widgets];
      return ok(dashboardLayout());
    }
    if (method === "DELETE" && path === "/admin/dashboard/layout") {
      dashboardWidgets = [...DASHBOARD_DEFAULTS];
      return ok(dashboardLayout());
    }
    const widgetMatch = /^\/admin\/dashboard\/widgets\/([^/]+)$/.exec(path);
    if (widgetMatch && method === "GET") {
      const id = decodeURIComponent(widgetMatch[1]);
      const item = DASHBOARD_CATALOG.find((c) => c.id === id);
      if (!item) return notFound("Widget");
      return ok({
        ...PAYLOAD_BY_KIND[item.kind],
        id: item.id,
        range: (params.get("range") ?? "30d") as WidgetBody["range"],
      });
    }

    // Settings
    if (method === "GET" && path === "/admin/settings") {
      return ok({ settings } satisfies Schemas["PlatformSettingList"]);
    }
    const settingMatch = /^\/admin\/settings\/([^/]+)$/.exec(path);
    if (settingMatch && method === "PUT") {
      const setting = settings.find(
        (s) => s.key === decodeURIComponent(settingMatch[1]),
      );
      if (!setting) return notFound("Setting");
      const input = body as Schemas["UpdateSettingInput"];
      Object.assign(setting, {
        value: input.value,
        updatedAt: NOW,
        updatedByName: ADMIN_NAME,
      });
      return ok(setting);
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
      reads.push({
        method,
        path,
        query: Object.fromEntries(url.searchParams),
      });
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
