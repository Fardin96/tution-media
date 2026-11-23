import type { BrowserContext, Route } from "@playwright/test";
import type { components } from "@/lib/api-types";
import { tutorProfile } from "./profile-mocks";

type Schemas = components["schemas"];
type Detail = Schemas["TutorFeeDetail"];
type FeeStatus = Detail["status"];
type Payment = Schemas["TutorFeePayment"];
type Refund = Schemas["TutorRefund"];
type Attempt = Schemas["PaymentAttemptView"];
type AttemptStatus = Attempt["status"];
type Quote = Schemas["CheckoutQuote"];

/** Same rate the API's gateway_charge_percent setting uses in these tests. */
export const CHARGE_PERCENT = 2.5;

/** Codes the fake accepts (upper case), with the percent each takes off. */
const PROMO_PERCENT: Record<string, number> = { WELCOME10: 10, FREE100: 100 };

const APPLIED_AT = "2026-11-18T09:00:00.000Z";
const CONFIRMED_AT = "2026-11-10T00:00:00.000Z";
const DUE_AT = "2026-11-30T00:00:00.000Z";
const REFUNDABLE_UNTIL = "2026-11-25T18:00:00.000Z";

/** The quote an attempt was started with, unless a test says otherwise (1500.00 fee + 2.5%). */
const DEFAULT_QUOTE = {
  feeAmount: "1500.00",
  chargeAmount: "37.50",
  totalAmount: "1537.50",
};

// Money is handled in cents so the fake adds up the way the API does.
const toCents = (money: string) => Math.round(Number(money) * 100);
const toMoney = (cents: number) => (cents / 100).toFixed(2);
const chargeOn = (cents: number) => Math.round((cents * CHARGE_PERCENT) / 100);

export interface FeeSeed {
  id: string;
  /** Defaults to DUE. A WAIVED or VOID fee is set here directly. */
  status?: FeeStatus;
  /** Placement fee in decimal money. Defaults to "1500.00". */
  amount?: string;
  studentName?: string;
  packageTitle?: string | null;
  payments?: Payment[];
  refunds?: Refund[];
  pendingAttempt?: Detail["pendingAttempt"];
  /** The gateway is switched off, so the checkout quote says PAYMENTS_OFF. */
  paymentsOff?: boolean;
  /** Online payments held off the ledger. A REVIEW one pauses checkout (IN_REVIEW). */
  heldPayments?: Detail["heldPayments"];
}

export interface AttemptSeed {
  /** The status each GET returns, in order. The last one repeats. */
  statuses: AttemptStatus[];
  failureReason?: string | null;
}

export interface PaymentsSeed {
  fees: FeeSeed[];
  /** Keyed by tran id, the way the result page reads `?tran=`. */
  attempts?: Record<string, AttemptSeed>;
  /** When set, a refund request answers 409 REFUND_NOT_ALLOWED with this message. */
  refundRefusal?: string;
}

export interface RecordedWrite {
  method: string;
  path: string;
  body: unknown;
}

interface FeeState {
  id: string;
  status: FeeStatus;
  amount: number;
  studentName: string;
  packageTitle: string | null;
  payments: Payment[];
  refunds: Refund[];
  pendingAttempt: Detail["pendingAttempt"];
  paymentsOff: boolean;
  heldPayments: Detail["heldPayments"];
  promo: { code: string; percent: number } | null;
}

function toState(seed: FeeSeed): FeeState {
  return {
    id: seed.id,
    status: seed.status ?? "DUE",
    amount: toCents(seed.amount ?? "1500.00"),
    studentName: seed.studentName ?? "Rahim Uddin",
    packageTitle: seed.packageTitle ?? null,
    payments: seed.payments ?? [],
    refunds: seed.refunds ?? [],
    pendingAttempt: seed.pendingAttempt ?? null,
    paymentsOff: seed.paymentsOff ?? false,
    heldPayments: seed.heldPayments ?? [],
    promo: null,
  };
}

function quoteOf(
  remaining: number,
  paymentsOff: boolean,
  inReview: boolean,
): Quote {
  const charge = chargeOn(remaining);
  const unavailableReason = inReview
    ? "IN_REVIEW"
    : paymentsOff
      ? "PAYMENTS_OFF"
      : null;
  return {
    enabled: unavailableReason === null,
    unavailableReason,
    feeAmount: toMoney(remaining),
    chargePercent: CHARGE_PERCENT.toFixed(2),
    chargeAmount: toMoney(charge),
    totalAmount: toMoney(remaining + charge),
  };
}

/** The detail the API returns for a fee in its current state. Mirrors the rules the UI relies on. */
function detailOf(fee: FeeState): Detail {
  const discount = fee.promo
    ? Math.round((fee.amount * fee.promo.percent) / 100)
    : 0;
  // A code that covers the whole fee keeps amount_due at the full fee; the UI shows it as waived.
  const waived = fee.promo?.percent === 100;
  const due = waived ? fee.amount : fee.amount - discount;
  const paid = fee.payments.reduce(
    (sum, p) => sum + (p.kind === "REVERSAL" ? -1 : 1) * toCents(p.amount),
    0,
  );
  const remaining = due - paid;
  const status: FeeStatus = waived ? "WAIVED" : fee.status;
  const open = (status === "DUE" || status === "PARTIAL") && remaining > 0;
  const inReview = fee.heldPayments.some((h) => h.status === "REVIEW");
  const promoAllowed = open && fee.promo === null && paid === 0 && !inReview;

  return {
    id: fee.id,
    feeType: "PLACEMENT",
    status,
    amountDue: toMoney(due),
    amountPaid: toMoney(paid),
    remaining: toMoney(remaining),
    dueDate: DUE_AT,
    overdue: false,
    unpaid: false,
    createdAt: CONFIRMED_AT,
    application: {
      id: `app_${fee.id}`,
      kind: "REQUIREMENT",
      confirmedAt: CONFIRMED_AT,
      packageTitle: fee.packageTitle,
      studentName: fee.studentName,
    },
    payments: fee.payments,
    refunds: fee.refunds,
    checkout: open ? quoteOf(remaining, fee.paymentsOff, inReview) : null,
    pendingAttempt: fee.pendingAttempt,
    promo: fee.promo
      ? {
          code: fee.promo.code,
          discountAmount: toMoney(discount),
          originalAmount: toMoney(fee.amount),
          appliedAt: APPLIED_AT,
        }
      : null,
    promoAllowed,
    heldPayments: fee.heldPayments,
  } satisfies Detail;
}

function listItemOf(detail: Detail): Schemas["TutorFee"] {
  return {
    id: detail.id,
    feeType: detail.feeType,
    status: detail.status,
    amountDue: detail.amountDue,
    amountPaid: detail.amountPaid,
    remaining: detail.remaining,
    dueDate: detail.dueDate,
    overdue: detail.overdue,
    unpaid: detail.unpaid,
    createdAt: detail.createdAt,
    application: detail.application,
  } satisfies Schemas["TutorFee"];
}

/**
 * Fakes the tutor fee endpoints (list, detail, promo, checkout, attempt, refunds) with state that
 * changes on writes. Every non-GET request is recorded in the returned `writes`.
 */
export async function mockPaymentsApi(
  context: BrowserContext,
  seed: PaymentsSeed,
) {
  const fees = new Map(seed.fees.map((s) => [s.id, toState(s)]));
  const attemptCalls = new Map<string, number>();
  const writes: RecordedWrite[] = [];

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  const apiError = (
    route: Route,
    status: number,
    error: string,
    code: Schemas["ErrorResponse"]["code"],
    message: string,
  ) =>
    json(
      route,
      { error, code, message } satisfies Schemas["ErrorResponse"],
      status,
    );

  await context.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace("/api/v1", "");
    const method = req.method();
    const body = req.postDataJSON?.() ?? null;
    if (method !== "GET") writes.push({ method, path, body });

    if (path === "/me")
      return json(route, {
        account: {
          id: "acc_1",
          role: "TUTOR",
          email: "test@example.com",
          avatarUrl: null,
          status: "ACTIVE",
          consentVersion: null,
          consentAcceptedAt: null,
          createdAt: "2026-09-01T00:00:00.000Z",
          lastLoginAt: null,
          deletedAt: null,
          adminUser: null,
          tutor: tutorProfile,
        } satisfies Schemas["MeAccount"],
      } satisfies Schemas["Me"]);

    // The dashboard shell's notification bell.
    if (path === "/notifications/unread-count")
      return json(route, { count: 0 } satisfies Schemas["UnreadCount"]);
    if (path === "/notifications")
      return json(route, {
        notifications: [],
        nextCursor: null,
        unreadCount: 0,
      } satisfies Schemas["NotificationPage"]);

    if (path === "/fees/mine")
      return json(route, {
        fees: [...fees.values()].map((f) => listItemOf(detailOf(f))),
        nextCursor: null,
      } satisfies Schemas["TutorFeePage"]);

    const feeMatch = path.match(/^\/fees\/([^/]+)(\/.*)?$/);
    if (feeMatch) {
      const fee = fees.get(decodeURIComponent(feeMatch[1]));
      const rest = feeMatch[2] ?? "";
      if (!fee)
        return apiError(route, 404, "NotFound", "NOT_FOUND", "Fee not found.");

      if (method === "GET" && rest === "") return json(route, detailOf(fee));

      if (method === "POST" && rest === "/promo") {
        const code = String((body as { code?: string } | null)?.code ?? "")
          .trim()
          .toUpperCase();
        const percent = PROMO_PERCENT[code];
        if (percent === undefined || !detailOf(fee).promoAllowed)
          return apiError(
            route,
            409,
            "PromoInvalid",
            "PROMO_INVALID",
            "That code isn't valid for this fee.",
          );
        fee.promo = { code, percent };
        return json(route, detailOf(fee));
      }

      if (method === "DELETE" && rest === "/promo") {
        fee.promo = null;
        return json(route, detailOf(fee));
      }

      if (method === "POST" && rest === "/checkout") {
        const quote = detailOf(fee).checkout;
        if (!quote)
          return apiError(
            route,
            409,
            "InvalidFeeState",
            "INVALID_FEE_STATE",
            "This fee can't be paid online right now.",
          );
        if (!quote.enabled)
          return apiError(
            route,
            503,
            "PaymentsDisabled",
            "PAYMENTS_DISABLED",
            "Online payments are turned off right now. Try again later.",
          );
        return json(
          route,
          {
            tranId: "TR_NEW",
            gatewayUrl: `https://sandbox.sslcommerz.com/gwprocess/v4/gw.php?sessionkey=TEST_${fee.id}`,
            feeAmount: quote.feeAmount,
            chargeAmount: quote.chargeAmount,
            totalAmount: quote.totalAmount,
          } satisfies Schemas["CheckoutSession"],
          201,
        );
      }

      if (method === "POST" && rest === "/refunds") {
        if (seed.refundRefusal)
          return apiError(
            route,
            409,
            "RefundNotAllowed",
            "REFUND_NOT_ALLOWED",
            seed.refundRefusal,
          );
        const { paymentId, reason } = body as {
          paymentId: string;
          reason: string;
        };
        const payment = fee.payments.find((p) => p.id === paymentId);
        if (!payment)
          return apiError(
            route,
            404,
            "NotFound",
            "NOT_FOUND",
            "Payment not found.",
          );
        fee.refunds.push({
          id: `ref_${fee.refunds.length + 1}`,
          paymentId,
          amount: payment.amount,
          status: "REQUESTED",
          reason,
          createdAt: APPLIED_AT,
          completedAt: null,
          decisionNote: null,
        });
        return json(route, detailOf(fee), 201);
      }

      const attemptMatch = rest.match(/^\/attempts\/([^/]+)$/);
      if (method === "GET" && attemptMatch) {
        const tranId = decodeURIComponent(attemptMatch[1]);
        const attempt = seed.attempts?.[tranId];
        if (!attempt)
          return apiError(
            route,
            404,
            "NotFound",
            "NOT_FOUND",
            "Payment not found.",
          );

        const calls = attemptCalls.get(tranId) ?? 0;
        attemptCalls.set(tranId, calls + 1);
        const status =
          attempt.statuses[Math.min(calls, attempt.statuses.length - 1)];

        // A confirmed payment lands on the fee, the way the gateway settlement does.
        const before = detailOf(fee);
        if (status === "SUCCEEDED" && before.remaining !== "0.00") {
          fee.payments.push({
            id: `pay_${tranId}`,
            kind: "PAYMENT",
            amount: before.remaining,
            method: "SSLCOMMERZ",
            receivedAt: APPLIED_AT,
            reversesPaymentId: null,
            refundableUntil: REFUNDABLE_UNTIL,
          });
          fee.status = "PAID";
          fee.pendingAttempt = null;
        }

        const after = detailOf(fee);
        return json(route, {
          tranId,
          status,
          ...DEFAULT_QUOTE,
          failureReason:
            status === "FAILED" ? (attempt.failureReason ?? null) : null,
          createdAt: APPLIED_AT,
          settledAt: status === "PENDING" ? null : APPLIED_AT,
          fee: {
            status: after.status,
            amountDue: after.amountDue,
            amountPaid: after.amountPaid,
            remaining: after.remaining,
          },
        } satisfies Attempt);
      }
    }

    return apiError(route, 404, "NotFound", "NOT_FOUND", "not mocked");
  });

  return { writes };
}
