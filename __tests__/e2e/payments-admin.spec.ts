import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  adminSessionCookie,
  mockAdminApi,
  type AdminMockOptions,
} from "./admin-mocks";

async function signIn(context: BrowserContext, options: AdminMockOptions) {
  await context.addCookies([adminSessionCookie]);
  return mockAdminApi(context, options);
}

test.describe("Admin payments", () => {
  test("opens on Needs attention and shows the summary", async ({
    page,
    context,
  }) => {
    const api = await signIn(context, { adminRole: "SUPER_ADMIN" });
    await page.goto("/dashboard/admin/payments");

    await expect(
      page.getByRole("heading", { level: 1, name: "Payments" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Needs attention", pressed: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /SSL-REVIEW-1001/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /SSL-PAID-2002/ })).toHaveCount(
      0,
    );

    const summary = page.getByRole("list", { name: "Payment summary" });
    const tile = (label: string) =>
      summary.getByRole("listitem").filter({ hasText: label });
    await expect(tile("Needs review")).toContainText("1");
    await expect(tile("Not applied")).toContainText("0");
    await expect(tile("Stuck over an hour")).toContainText("2");
    await expect(tile("Paid in the last 24 h")).toContainText("3");

    const listCalls = api.reads.filter(
      (r) => r.path === "/admin/payment-attempts",
    );
    expect(listCalls.at(-1)?.query).toEqual({ attention: "true" });

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(
      page.getByRole("link", { name: /SSL-PAID-2002/ }),
    ).toBeVisible();
    expect(api.unmocked).toEqual([]);
  });

  test("approves a flagged payment with a note", async ({ page, context }) => {
    const api = await signIn(context, { adminRole: "SUPER_ADMIN" });
    await page.goto("/dashboard/admin/payments/SSL-REVIEW-1001");

    await expect(
      page.getByRole("heading", { level: 1, name: "Online payment" }),
    ).toBeVisible();
    await expect(
      page.getByText("The gateway paid 1537.50, which doesn't match the fee."),
    ).toBeVisible();

    await page.getByRole("button", { name: "Approve", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Approve this payment?" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Approve payment" }).click();
    await expect(
      dialog.getByText("Write a note with at least 3 characters."),
    ).toBeVisible();
    expect(api.writes).toEqual([]);

    await dialog.getByLabel("Note").fill("Matched in the SSLCommerz panel");
    await dialog.getByRole("button", { name: "Approve payment" }).click();

    await expect(page.getByText("Payment approved.")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Approve", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Confirmed by the gateway and added to the fee."),
    ).toBeVisible();
    expect(api.writes).toEqual([
      {
        method: "POST",
        path: "/admin/payment-attempts/SSL-REVIEW-1001/review",
        body: {
          decision: "APPROVE",
          note: "Matched in the SSLCommerz panel",
        },
      },
    ]);
    expect(api.unmocked).toEqual([]);
  });

  test("a plain admin sees the payment but no decision buttons", async ({
    page,
    context,
  }) => {
    const api = await signIn(context, { adminRole: "ADMIN" });
    await page.goto("/dashboard/admin/payments/SSL-REVIEW-1001");

    await expect(
      page.getByText("A super admin decides flagged payments."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Check with gateway" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Reject", exact: true }),
    ).toHaveCount(0);
    expect(api.unmocked).toEqual([]);
  });

  test("refunds the fee part of a paid payment from its page", async ({
    page,
    context,
  }) => {
    const api = await signIn(context, { adminRole: "SUPER_ADMIN" });
    await page.goto("/dashboard/admin/payments/SSL-PAID-2002");

    await page.getByRole("button", { name: "Refund", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Refund this payment?" });
    await expect(dialog).toContainText("Refunds the fee part only.");
    await expect(dialog.getByLabel("Amount (৳)")).toHaveValue("1350.00");

    await dialog.getByRole("button", { name: "Start refund" }).click();
    await expect(
      dialog.getByText("Write at least 3 characters."),
    ).toBeVisible();
    expect(api.writes).toEqual([]);

    await dialog.getByLabel("Reason").fill("Student left after week one");
    await dialog.getByRole("button", { name: "Start refund" }).click();

    await expect(page).toHaveURL(/\/dashboard\/admin\/refunds\/rf_3$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Refund" }),
    ).toBeVisible();
    // The amount was left at the refundable total, so the request sends no amount.
    expect(api.writes).toEqual([
      {
        method: "POST",
        path: "/admin/refunds",
        body: {
          tranId: "SSL-PAID-2002",
          reason: "Student left after week one",
        },
      },
    ]);
    expect(api.unmocked).toEqual([]);
  });
});

test.describe("Admin promo codes", () => {
  test("validates the new code dialog and opens the created code", async ({
    page,
    context,
  }) => {
    const api = await signIn(context, { adminRole: "SUPER_ADMIN" });
    await page.goto("/dashboard/admin/promo-codes");

    await page.getByRole("button", { name: "New code" }).click();
    const dialog = page.getByRole("dialog", { name: "New promo code" });
    await dialog.getByRole("button", { name: "Create code" }).click();
    await expect(dialog.getByText("Enter a code.")).toBeVisible();
    await expect(dialog.getByText("Enter an amount above 0.")).toBeVisible();
    expect(api.writes).toEqual([]);

    await dialog.getByLabel("Code", { exact: true }).fill("bad code!");
    await dialog.getByLabel("Value", { exact: true }).fill("150");
    await dialog.getByRole("button", { name: "Create code" }).click();
    await expect(
      dialog.getByText(
        "Use 3 to 32 letters, digits, - or _, starting with a letter or digit.",
      ),
    ).toBeVisible();
    await expect(
      dialog.getByText("A percent discount can be at most 100."),
    ).toBeVisible();
    expect(api.writes).toEqual([]);

    await dialog.getByLabel("Code", { exact: true }).fill("welcome10");
    await dialog.getByLabel("Value", { exact: true }).fill("10");
    await dialog
      .getByLabel("Description (optional)")
      .fill("Welcome offer for new tutors");
    await dialog.getByRole("button", { name: "Create code" }).click();

    await expect(page).toHaveURL(/\/dashboard\/admin\/promo-codes\/promo_3$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Promo code" }),
    ).toBeVisible();
    await expect(page.getByText("WELCOME10")).toBeVisible();
    expect(api.writes).toEqual([
      {
        method: "POST",
        path: "/admin/promo-codes",
        body: {
          code: "WELCOME10",
          description: "Welcome offer for new tutors",
          discountType: "PERCENT",
          discountValue: 10,
          maxPerTutor: 1,
        },
      },
    ]);
    expect(api.unmocked).toEqual([]);
  });

  test("shows a taken code as an error on the code field", async ({
    page,
    context,
  }) => {
    const api = await signIn(context, { adminRole: "SUPER_ADMIN" });
    await page.goto("/dashboard/admin/promo-codes");

    await page.getByRole("button", { name: "New code" }).click();
    const dialog = page.getByRole("dialog", { name: "New promo code" });
    await dialog.getByLabel("Code", { exact: true }).fill("ramadan15");
    await dialog.getByLabel("Value", { exact: true }).fill("10");
    await dialog.getByRole("button", { name: "Create code" }).click();

    await expect(
      dialog.getByText("A promo code with that name already exists."),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard\/admin\/promo-codes$/);
    expect(api.writes).toHaveLength(1);
    expect(api.unmocked).toEqual([]);
  });

  test("turns a code off from its page", async ({ page, context }) => {
    const api = await signIn(context, { adminRole: "SUPER_ADMIN" });
    await page.goto("/dashboard/admin/promo-codes/promo_1");

    await expect(page.getByText("RAMADAN15").first()).toBeVisible();
    await page.getByRole("button", { name: "Turn off", exact: true }).click();

    await expect(page.getByText("Code turned off.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Turn on", exact: true }),
    ).toBeVisible();
    expect(api.writes).toEqual([
      {
        method: "PATCH",
        path: "/admin/promo-codes/promo_1",
        body: { isActive: false },
      },
    ]);
    expect(api.unmocked).toEqual([]);
  });

  test("a plain admin can read codes but not create or change them", async ({
    page,
    context,
  }) => {
    const api = await signIn(context, { adminRole: "ADMIN" });
    await page.goto("/dashboard/admin/promo-codes");

    await expect(page.getByRole("link", { name: /RAMADAN15/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "New code" })).toHaveCount(0);

    await page.getByRole("link", { name: /RAMADAN15/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/admin\/promo-codes\/promo_1$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Promo code" }),
    ).toBeVisible();
    await expect(page.getByText("Ramadan offer")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Edit", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Turn off", exact: true }),
    ).toHaveCount(0);
    expect(api.writes).toEqual([]);
    expect(api.unmocked).toEqual([]);
  });
});

test.describe("Admin refunds", () => {
  test("lists refunds in progress by default and all on request", async ({
    page,
    context,
  }) => {
    const api = await signIn(context, { adminRole: "SUPER_ADMIN" });
    await page.goto("/dashboard/admin/refunds");

    await expect(
      page.getByRole("button", { name: "In progress", pressed: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /SSL-PAID-2002/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /SSL-OLD-1500/ })).toHaveCount(
      0,
    );
    expect(
      api.reads.filter((r) => r.path === "/admin/refunds").at(-1)?.query,
    ).toEqual({ open: "true" });

    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(
      page.getByRole("link", { name: /SSL-OLD-1500/ }),
    ).toBeVisible();
    expect(api.unmocked).toEqual([]);
  });

  test("approves a refund that needs review, then resolves it by hand", async ({
    page,
    context,
  }) => {
    const api = await signIn(context, {
      adminRole: "SUPER_ADMIN",
      approveOutcome: "NEEDS_REVIEW",
    });
    await page.goto("/dashboard/admin/refunds/rf_1");

    await expect(
      page.getByRole("heading", { level: 1, name: "Refund" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    const approve = page.getByRole("dialog", { name: "Approve this refund?" });
    await approve.getByRole("button", { name: "Approve refund" }).click();

    await expect(
      page.getByText(
        "The gateway didn't answer clearly. Check the merchant panel.",
      ),
    ).toBeVisible();
    await expect(approve).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Approve", exact: true }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Resolve", exact: true }).click();
    const resolve = page.getByRole("dialog", {
      name: "Resolve this refund by hand?",
    });
    await resolve.getByRole("button", { name: "Resolve refund" }).click();
    await expect(
      resolve.getByText("Choose what happened at the gateway."),
    ).toBeVisible();

    await resolve.getByLabel("The money was refunded").check();
    await resolve
      .getByLabel("Gateway refund reference (optional)")
      .fill("GW-REF-7781");
    await resolve.getByLabel("Note", { exact: true }).fill("Seen in the panel");
    await resolve.getByRole("button", { name: "Resolve refund" }).click();

    await expect(page.getByText("Refund resolved.")).toBeVisible();
    await expect(resolve).toBeHidden();
    await expect(page.getByText("The fee is due again.")).toBeVisible();
    expect(api.writes).toEqual([
      { method: "POST", path: "/admin/refunds/rf_1/approve", body: {} },
      {
        method: "POST",
        path: "/admin/refunds/rf_1/resolve",
        body: {
          outcome: "SUCCEEDED",
          refundRefId: "GW-REF-7781",
          note: "Seen in the panel",
        },
      },
    ]);
    expect(api.unmocked).toEqual([]);
  });

  test("a plain admin sees the refund without decision buttons", async ({
    page,
    context,
  }) => {
    const api = await signIn(context, { adminRole: "ADMIN" });
    await page.goto("/dashboard/admin/refunds/rf_1");

    await expect(
      page.getByText("A super admin decides refunds."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^(Approve|Decline|Resolve)$/ }),
    ).toHaveCount(0);
    expect(api.writes).toEqual([]);
    expect(api.unmocked).toEqual([]);
  });

  test("has no horizontal scroll at 320px", async ({ page, context }) => {
    await signIn(context, { adminRole: "SUPER_ADMIN" });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto("/dashboard/admin/refunds");

    await expect(
      page.getByRole("link", { name: /SSL-PAID-2002/ }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
});

test.describe("Admin settings", () => {
  const refundWindow = (page: Page) =>
    page.locator("section").filter({
      has: page.getByRole("heading", { name: "Refund window", exact: true }),
    });

  test("saves a new refund window", async ({ page, context }) => {
    const api = await signIn(context, { adminRole: "SUPER_ADMIN" });
    await page.goto("/dashboard/admin/settings");

    const section = refundWindow(page);
    await expect(section.getByText("Using the default.")).toBeVisible();
    await section.getByLabel("Days", { exact: true }).fill("14");
    await section.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Setting saved")).toBeVisible();
    await expect(section).toContainText("by Sabbir Ahmed");
    expect(api.writes).toEqual([
      {
        method: "PUT",
        path: "/admin/settings/refund_window_days",
        body: { value: 14 },
      },
    ]);
    expect(api.unmocked).toEqual([]);
  });

  test("rejects a refund window above 90 days", async ({ page, context }) => {
    const api = await signIn(context, { adminRole: "SUPER_ADMIN" });
    await page.goto("/dashboard/admin/settings");

    const section = refundWindow(page);
    await section.getByLabel("Days", { exact: true }).fill("91");
    await section.getByRole("button", { name: "Save", exact: true }).click();

    await expect(section.getByText("Use 0 to 90 days.")).toBeVisible();
    expect(api.writes).toEqual([]);
  });

  test("a plain admin sees the settings read-only", async ({
    page,
    context,
  }) => {
    const api = await signIn(context, { adminRole: "ADMIN" });
    await page.goto("/dashboard/admin/settings");

    await expect(
      page.getByText("Only a super admin can change settings."),
    ).toBeVisible();
    await expect(refundWindow(page)).toContainText("7 days");
    await expect(page.getByRole("switch")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Save", exact: true }),
    ).toHaveCount(0);
    expect(api.writes).toEqual([]);
    expect(api.unmocked).toEqual([]);
  });
});
