import {
  test,
  expect,
  type BrowserContext,
  type Locator,
} from "@playwright/test";
import { sessionCookie } from "./profile-mocks";
import { mockPaymentsApi, type PaymentsSeed } from "./payments-mocks";

const PAYMENT = {
  id: "pay_1",
  kind: "PAYMENT" as const,
  amount: "1500.00",
  method: "SSLCOMMERZ" as const,
  receivedAt: "2026-11-12T10:00:00.000Z",
  reversesPaymentId: null,
  refundableUntil: "2026-11-25T18:00:00.000Z",
};

/** A fee the tutor has paid online, with a payment that can still be refunded. */
const PAID_FEE = {
  id: "fee_1",
  status: "PAID" as const,
  payments: [PAYMENT],
};

async function setUp(context: BrowserContext, seed: PaymentsSeed) {
  await context.addCookies([sessionCookie("TUTOR")]);
  // The gateway page is outside the app: answer it with a stub so the redirect can be asserted.
  await context.route("https://sandbox.sslcommerz.com/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>SSLCommerz sandbox</title></head><body><h1>SSLCommerz sandbox</h1></body></html>',
    }),
  );
  return mockPaymentsApi(context, seed);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The value of one labelled row in a Summary-style list, such as "Amount due". Matches the <dt>
 * text directly, because Chromium gives a <dt> no accessible name from its text.
 */
function rowValue(scope: Locator, label: string) {
  return scope
    .locator("dt")
    .filter({ hasText: new RegExp(`^${escapeRegExp(label)}$`) })
    .locator("xpath=following-sibling::dd[1]");
}

test.describe("Placement fees list and detail", () => {
  test("opens a fee from the list", async ({ page, context }) => {
    await setUp(context, {
      fees: [
        { id: "fee_1", packageTitle: "Physics, Class 9" },
        {
          id: "fee_2",
          status: "PAID",
          studentName: "Karim Ahmed",
          amount: "1200.00",
          payments: [{ ...PAYMENT, id: "pay_2", amount: "1200.00" }],
        },
      ],
    });

    await page.goto("/dashboard/fees");
    await expect(
      page.getByRole("heading", { level: 1, name: "Placement fees" }),
    ).toBeVisible();

    const rahim = page.getByRole("link", { name: /Rahim Uddin/ });
    await expect(rahim).toContainText("Physics, Class 9");
    await expect(rahim.getByText("Pay", { exact: true })).toBeVisible();

    const karim = page.getByRole("link", { name: /Karim Ahmed/ });
    await expect(karim).toContainText("Paid");
    await expect(karim.getByText("Pay", { exact: true })).toHaveCount(0);

    await rahim.click();
    await expect(page).toHaveURL(/\/dashboard\/fees\/fee_1$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Rahim Uddin" }),
    ).toBeVisible();
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(rowValue(summary, "Amount due")).toHaveText("৳1,500.00");
    await expect(rowValue(summary, "Remaining")).toHaveText("৳1,500.00");
  });

  test("says so when there are no fees", async ({ page, context }) => {
    await setUp(context, { fees: [] });
    await page.goto("/dashboard/fees");
    await expect(page.getByText("No placement fees yet.")).toBeVisible();
  });

  test("says so when the fee does not exist", async ({ page, context }) => {
    await setUp(context, { fees: [] });
    await page.goto("/dashboard/fees/missing");
    await expect(
      page.getByText("We couldn't find that fee.", { exact: true }),
    ).toBeVisible();
  });
});

test.describe("Promo code", () => {
  test("a refused code shows the reason beside the field", async ({
    page,
    context,
  }) => {
    const { writes } = await setUp(context, { fees: [{ id: "fee_1" }] });
    await page.goto("/dashboard/fees/fee_1");

    const promo = page.getByRole("region", { name: "Promo code" });
    await promo.getByLabel("Promo code").fill("NOPE");
    await promo.getByRole("button", { name: "Apply" }).click();

    await expect(
      promo.getByText("That code isn't valid for this fee."),
    ).toBeVisible();
    await expect(promo.getByLabel("Promo code")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      rowValue(page.getByRole("region", { name: "Summary" }), "Amount due"),
    ).toHaveText("৳1,500.00");
    expect(writes).toEqual([
      { method: "POST", path: "/fees/fee_1/promo", body: { code: "NOPE" } },
    ]);
  });

  test("an empty code asks for one without calling the API", async ({
    page,
    context,
  }) => {
    const { writes } = await setUp(context, { fees: [{ id: "fee_1" }] });
    await page.goto("/dashboard/fees/fee_1");

    const promo = page.getByRole("region", { name: "Promo code" });
    await promo.getByRole("button", { name: "Apply" }).click();
    await expect(promo.getByText("Enter a code.")).toBeVisible();
    expect(writes).toHaveLength(0);
  });

  test("a good code updates the summary and the pay button, and can be removed", async ({
    page,
    context,
  }) => {
    const { writes } = await setUp(context, { fees: [{ id: "fee_1" }] });
    await page.goto("/dashboard/fees/fee_1");

    const promo = page.getByRole("region", { name: "Promo code" });
    await promo.getByLabel("Promo code").fill("welcome10");
    await promo.getByRole("button", { name: "Apply" }).click();

    await expect(
      page.getByText("Code applied.", { exact: true }),
    ).toBeVisible();
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(rowValue(summary, "Original amount")).toHaveText("৳1,500.00");
    await expect(rowValue(summary, "Promo WELCOME10")).toHaveText("−৳150.00");
    await expect(rowValue(summary, "Amount due")).toHaveText("৳1,350.00");
    await expect(rowValue(summary, "Remaining")).toHaveText("৳1,350.00");
    await expect(page.getByText("WELCOME10 takes ৳150.00 off.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pay ৳1,383.75 with SSLCommerz" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Remove code" }).click();
    await expect(
      page.getByText("Code removed.", { exact: true }),
    ).toBeVisible();
    await expect(rowValue(summary, "Amount due")).toHaveText("৳1,500.00");
    await expect(rowValue(summary, "Original amount")).toHaveCount(0);
    await expect(promo.getByLabel("Promo code")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pay ৳1,537.50 with SSLCommerz" }),
    ).toBeVisible();

    expect(writes).toEqual([
      {
        method: "POST",
        path: "/fees/fee_1/promo",
        body: { code: "welcome10" },
      },
      { method: "DELETE", path: "/fees/fee_1/promo", body: null },
    ]);
  });

  test("a code that covers the whole fee waives it", async ({
    page,
    context,
  }) => {
    await setUp(context, { fees: [{ id: "fee_1" }] });
    await page.goto("/dashboard/fees/fee_1");

    const promo = page.getByRole("region", { name: "Promo code" });
    await promo.getByLabel("Promo code").fill("FREE100");
    await promo.getByRole("button", { name: "Apply" }).click();

    await expect(
      page.getByText("Code applied. Nothing left to pay.", { exact: true }),
    ).toBeVisible();
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary.getByText("Waived", { exact: true })).toBeVisible();
    await expect(rowValue(summary, "Amount due")).toHaveText("৳0.00");
    await expect(rowValue(summary, "Remaining")).toHaveText("৳0.00");
    await expect(
      page.getByText("Your promo code covered this fee."),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Pay online" })).toHaveCount(
      0,
    );
  });
});

test.describe("Pay online", () => {
  test("Pay starts checkout and sends the tutor to SSLCommerz", async ({
    page,
    context,
  }) => {
    const { writes } = await setUp(context, { fees: [{ id: "fee_1" }] });
    await page.goto("/dashboard/fees/fee_1");

    const pay = page.getByRole("region", { name: "Pay online" });
    await expect(rowValue(pay, "Placement fee")).toHaveText("৳1,500.00");
    await expect(rowValue(pay, "Processing charge (2.5%)")).toHaveText(
      "৳37.50",
    );
    await expect(rowValue(pay, "Total")).toHaveText("৳1,537.50");

    await pay
      .getByRole("button", { name: "Pay ৳1,537.50 with SSLCommerz" })
      .click();
    await expect(page).toHaveURL(/sandbox\.sslcommerz\.com/);
    await expect(
      page.getByRole("heading", { name: "SSLCommerz sandbox" }),
    ).toBeVisible();
    expect(writes).toEqual([
      { method: "POST", path: "/fees/fee_1/checkout", body: null },
    ]);
  });

  test("explains why online payment is off", async ({ page, context }) => {
    await setUp(context, { fees: [{ id: "fee_1", paymentsOff: true }] });
    await page.goto("/dashboard/fees/fee_1");

    const pay = page.getByRole("region", { name: "Pay online" });
    await expect(
      pay.getByText(
        "Online payment is turned off right now. You can still pay the Tuition Media team in cash.",
      ),
    ).toBeVisible();
    await expect(pay.getByRole("button")).toHaveCount(0);
  });

  test("a payment still open links to its result page", async ({
    page,
    context,
  }) => {
    await setUp(context, {
      fees: [
        {
          id: "fee_1",
          pendingAttempt: {
            tranId: "TR_OLD",
            createdAt: "2026-11-18T08:00:00.000Z",
          },
        },
      ],
    });
    await page.goto("/dashboard/fees/fee_1");

    const pay = page.getByRole("region", { name: "Pay online" });
    await expect(pay.getByText(/is still open/)).toBeVisible();
    await expect(
      pay.getByRole("link", { name: "Check that payment" }),
    ).toHaveAttribute("href", "/dashboard/fees/fee_1/payment?tran=TR_OLD");
  });
});

test.describe("Payment result", () => {
  test("PENDING turns into SUCCEEDED after a poll", async ({
    page,
    context,
  }) => {
    await setUp(context, {
      fees: [{ id: "fee_1" }],
      attempts: { TR_1: { statuses: ["PENDING", "SUCCEEDED"] } },
    });
    await page.goto("/dashboard/fees/fee_1/payment?tran=TR_1");

    await expect(
      page.getByRole("heading", { level: 1, name: "Confirming your payment" }),
    ).toBeVisible();
    // The page polls every 2 s, so the second answer lands within a few seconds.
    await expect(
      page.getByRole("heading", { level: 1, name: "Payment received" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/You paid ৳1,537\.50\./)).toBeVisible();
    await expect(page.getByText("This fee is fully paid.")).toBeVisible();
    await expect(page.getByText("TR_1", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View fee" })).toHaveAttribute(
      "href",
      "/dashboard/fees/fee_1",
    );
  });

  test("FAILED offers Try again while the fee is open", async ({
    page,
    context,
  }) => {
    const { writes } = await setUp(context, {
      fees: [{ id: "fee_1" }],
      attempts: {
        TR_2: { statuses: ["FAILED"], failureReason: "Card declined" },
      },
    });
    await page.goto("/dashboard/fees/fee_1/payment?tran=TR_2");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Payment didn't go through",
      }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page).toHaveURL(/sandbox\.sslcommerz\.com/);
    expect(writes).toEqual([
      { method: "POST", path: "/fees/fee_1/checkout", body: null },
    ]);
  });

  test("FAILED on a paid fee offers no Try again", async ({
    page,
    context,
  }) => {
    await setUp(context, {
      fees: [PAID_FEE],
      attempts: { TR_3: { statuses: ["FAILED"] } },
    });
    await page.goto("/dashboard/fees/fee_1/payment?tran=TR_3");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Payment didn't go through",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(
      0,
    );
  });

  test("REVIEW says a person will check, and does not offer a retry", async ({
    page,
    context,
  }) => {
    await setUp(context, {
      fees: [{ id: "fee_1" }],
      attempts: { TR_4: { statuses: ["REVIEW"] } },
    });
    await page.goto("/dashboard/fees/fee_1/payment?tran=TR_4");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "We're checking this payment",
      }),
    ).toBeVisible();
    await expect(page.getByText(/Don't pay again\./)).toBeVisible();
    await expect(page.getByText("TR_4", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(
      0,
    );
  });
});

test.describe("Refund requests", () => {
  test("asks for a reason, sends the request and lists it", async ({
    page,
    context,
  }) => {
    const { writes } = await setUp(context, { fees: [PAID_FEE] });
    await page.goto("/dashboard/fees/fee_1");

    const payments = page.getByRole("region", { name: "Payments" });
    await payments.getByRole("button", { name: "Request a refund" }).click();

    const dialog = page.getByRole("dialog", { name: "Ask for a refund?" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("We refund the fee part (৳1,500.00)."),
    ).toBeVisible();

    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(
      dialog.getByText("Write at least 3 characters."),
    ).toBeVisible();

    await dialog.getByLabel("Reason").fill("ab");
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(
      dialog.getByText("Write at least 3 characters."),
    ).toBeVisible();
    expect(writes).toHaveLength(0);

    await dialog.getByLabel("Reason").fill("Charged twice");
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText("Refund requested.", { exact: true }),
    ).toBeVisible();
    expect(writes).toEqual([
      {
        method: "POST",
        path: "/fees/fee_1/refunds",
        body: { paymentId: "pay_1", reason: "Charged twice" },
      },
    ]);

    const refunds = page.getByRole("region", { name: "Refunds" });
    await expect(refunds.getByText("Requested", { exact: true })).toBeVisible();
    await expect(refunds.getByText("Charged twice")).toBeVisible();
    await expect(refunds.getByText("৳1,500.00")).toBeVisible();
  });

  test("a refused request keeps the dialog open and says why", async ({
    page,
    context,
  }) => {
    await setUp(context, {
      fees: [PAID_FEE],
      refundRefusal: "Refunds must be asked within 7 days of payment.",
    });
    await page.goto("/dashboard/fees/fee_1");

    await page
      .getByRole("region", { name: "Payments" })
      .getByRole("button", { name: "Request a refund" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Ask for a refund?" });
    await dialog.getByLabel("Reason").fill("Changed my mind");
    await dialog.getByRole("button", { name: "Send request" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(
      "Refunds must be asked within 7 days of payment.",
    );
    await expect(dialog).toBeVisible();
  });
});

test("the fee detail has no horizontal scroll at 320px", async ({
  page,
  context,
}) => {
  await setUp(context, {
    fees: [
      {
        ...PAID_FEE,
        refunds: [
          {
            id: "ref_1",
            paymentId: "pay_1",
            amount: "1500.00",
            status: "SUCCEEDED",
            reason:
              "The same placement fee was paid twice from two different bKash numbers by mistake.",
            createdAt: "2026-11-13T10:00:00.000Z",
            completedAt: "2026-11-14T10:00:00.000Z",
            decisionNote: "Refunded to the bKash number ending 4421.",
          },
        ],
      },
    ],
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/dashboard/fees/fee_1");
  await expect(
    page.getByRole("heading", { level: 1, name: "Rahim Uddin" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Refunds" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
