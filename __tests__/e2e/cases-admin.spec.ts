import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { adminSessionCookie, mockCasesApi } from "./cases-mocks";

async function signIn(context: BrowserContext) {
  await context.addCookies([adminSessionCookie]);
  return mockCasesApi(context);
}

type Api = Awaited<ReturnType<typeof signIn>>;

// Below lg the admin nav lives in the menu drawer. The button is React-driven, so a click
// before hydration does nothing; retry until the drawer is open.
async function openAdminNav(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) >= 1024) return;
  const drawer = page.getByRole("dialog", { name: "Admin menu" });
  await expect(async () => {
    if (!(await drawer.isVisible())) {
      await page.getByRole("button", { name: "Open admin menu" }).click();
    }
    await expect(drawer).toBeVisible({ timeout: 1000 });
  }).toPass();
}

// Background reads (the admin /me check, the notification count) can land after the list
// request, so look up the last read of the list itself rather than the last read overall.
function lastReadOf(api: Api, path: string) {
  return api.reads.filter((r) => r.path === path).at(-1);
}

test.describe("Admin reviews", () => {
  test("hides a review with a note", async ({ page, context }) => {
    const api = await signIn(context);
    await page.goto("/dashboard/admin/reviews");

    await expect(
      page.getByRole("heading", { level: 1, name: "Reviews" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Visible", pressed: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Shouted at my child and left early."),
    ).toBeVisible();
    await expect(page.getByText("Hidden earlier for abuse.")).toHaveCount(0);

    await page
      .getByRole("button", { name: "Hide review by Rafi Hasan" })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: "Hide this review?" });
    await dialog.getByRole("button", { name: "Hide review" }).click();
    await expect(
      dialog.getByText("Write at least 3 characters."),
    ).toBeVisible();
    expect(api.writes).toEqual([]);

    await dialog.getByLabel("Note").fill("Abusive language");
    await dialog.getByRole("button", { name: "Hide review" }).click();

    await expect(page.getByText("Review hidden")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText("Shouted at my child and left early."),
    ).toHaveCount(0);
    expect(api.writes).toEqual([
      {
        method: "PATCH",
        path: "/admin/reviews/rv_1",
        body: { status: "HIDDEN", note: "Abusive language" },
      },
    ]);

    await page.getByRole("button", { name: "Hidden", exact: true }).click();
    await expect(
      page.getByText("Shouted at my child and left early."),
    ).toBeVisible();
    expect(api.unmocked).toEqual([]);
  });

  test("filters by rating", async ({ page, context }) => {
    const api = await signIn(context);
    await page.goto("/dashboard/admin/reviews");

    // Wait for the unfiltered list: a click before hydration is dropped.
    const lowReview = page.getByText("Shouted at my child and left early.");
    await expect(lowReview).toBeVisible();

    await page.getByRole("button", { name: "5 stars" }).click();
    await expect(
      page.getByRole("button", { name: "5 stars", pressed: true }),
    ).toBeVisible();
    await expect(lowReview).toHaveCount(0);
    await expect(
      page.getByRole("img", { name: "Rated 5 out of 5" }).first(),
    ).toBeVisible();
    await expect
      .poll(() => lastReadOf(api, "/admin/reviews")?.query)
      .toMatchObject({ status: "VISIBLE", rating: "5" });
  });
});

test.describe("Admin reports", () => {
  test("shows the open queue, then the closed one", async ({
    page,
    context,
  }) => {
    const api = await signIn(context);
    await page.goto("/dashboard/admin/reports");

    await expect(
      page.getByRole("button", { name: "Open", pressed: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Contact outside the platform/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Spam/ })).toHaveCount(0);

    await page.getByRole("button", { name: "Closed", exact: true }).click();
    await expect(page.getByRole("link", { name: /Spam/ })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Contact outside the platform/ }),
    ).toHaveCount(0);
    await expect
      .poll(() => lastReadOf(api, "/admin/reports")?.query)
      .toMatchObject({ queue: "closed" });
    expect(api.unmocked).toEqual([]);
  });

  test("takes a report, then resolves it with a note", async ({
    page,
    context,
  }) => {
    const api = await signIn(context);
    await page.goto("/dashboard/admin/reports/rep_1");

    await expect(
      page.getByText("Asked me to pay by bKash directly."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open application" }),
    ).toHaveAttribute("href", "/dashboard/applications/app_1?from=admin");
    await expect(
      page.getByRole("link", { name: "Open account" }).first(),
    ).toHaveAttribute("href", "/dashboard/admin/accounts/acc_student");

    await page.getByRole("button", { name: "Take this case" }).click();
    await expect(page.getByText("You took this report.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Take this case" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Resolve", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Resolve this report?" });
    await dialog.getByRole("button", { name: "Resolve report" }).click();
    await expect(
      dialog.getByText("Write at least 3 characters."),
    ).toBeVisible();

    await dialog.getByLabel("Note").fill("Warned the tutor");
    await dialog.getByRole("button", { name: "Resolve report" }).click();

    await expect(page.getByText("Report resolved.")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Warned the tutor")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Resolve", exact: true }),
    ).toHaveCount(0);
    expect(api.writes).toEqual([
      {
        method: "PATCH",
        path: "/admin/reports/rep_1",
        body: { action: "ASSIGN" },
      },
      {
        method: "PATCH",
        path: "/admin/reports/rep_1",
        body: { action: "RESOLVE", note: "Warned the tutor" },
      },
    ]);
    expect(api.unmocked).toEqual([]);
  });

  test("a closed report shows its outcome and no actions", async ({
    page,
    context,
  }) => {
    await signIn(context);
    await page.goto("/dashboard/admin/reports/rep_2");

    await expect(page.getByText("Not spam, a reminder.")).toBeVisible();
    await expect(page.getByText("Tania Roy").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Dismiss" })).toHaveCount(0);
  });
});

test.describe("Admin disputes", () => {
  test("dismisses a dispute with a note", async ({ page, context }) => {
    const api = await signIn(context);
    await page.goto("/dashboard/admin/disputes");

    await page.getByRole("link", { name: /Payment\b.*Rafi/ }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Payment dispute" }),
    ).toBeVisible();
    await expect(page.getByText("Other open disputes on it")).toBeVisible();

    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Dismiss this dispute?" });
    await dialog.getByLabel("Note").fill("No evidence either way");
    await dialog.getByRole("button", { name: "Dismiss dispute" }).click();

    await expect(page.getByText("Dispute dismissed.")).toBeVisible();
    await expect(page.getByText("No evidence either way")).toBeVisible();
    expect(api.writes).toEqual([
      {
        method: "PATCH",
        path: "/admin/disputes/dis_1",
        body: { action: "DISMISS", note: "No evidence either way" },
      },
    ]);

    await openAdminNav(page);
    await page
      .getByRole("link", { name: "Disputes", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Closed", exact: true }).click();
    await expect(page.getByRole("link", { name: /Schedule/ })).toBeVisible();
    expect(api.unmocked).toEqual([]);
  });
});

test.describe("Admin navigation", () => {
  test("lists Reviews, Stories, Reports and Disputes after Videos", async ({
    page,
    context,
  }) => {
    await signIn(context);
    await page.goto("/dashboard/admin/reviews");
    await openAdminNav(page);

    const nav = page.getByRole("navigation", { name: "Admin" }).first();
    // The route skeleton streams first; read the links once the shell is in.
    await expect(nav.getByRole("link", { name: /Videos/ })).toBeVisible();
    const labels = await nav.getByRole("link").allInnerTexts();
    const trimmed = labels.map((l) => l.trim().split("\n")[0]);
    const videos = trimmed.indexOf("Videos");
    expect(videos).toBeGreaterThan(-1);
    expect(trimmed.slice(videos + 1, videos + 5)).toEqual([
      "Reviews",
      "Stories",
      "Reports",
      "Disputes",
    ]);
  });

  test("cancelling logout from the menu keeps the session and returns focus", async ({
    page,
    context,
  }) => {
    await signIn(context);
    await page.goto("/dashboard/admin");
    await openAdminNav(page);

    await page.getByRole("button", { name: "Log out" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();

    // On narrow screens the drawer is gone, so focus goes back to its button.
    if ((page.viewportSize()?.width ?? 1280) < 1024) {
      await expect(
        page.getByRole("button", { name: "Open admin menu" }),
      ).toBeFocused();
    }
  });
});

test.describe("320px", () => {
  for (const path of [
    "/dashboard/admin/reviews",
    "/dashboard/admin/reports",
    "/dashboard/admin/reports/rep_1",
    "/dashboard/admin/disputes",
    "/dashboard/admin/disputes/dis_1",
  ]) {
    test(`${path} has no horizontal scroll`, async ({ page, context }) => {
      await signIn(context);
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto(path);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Loading", { exact: false })).toHaveCount(0);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  }
});
