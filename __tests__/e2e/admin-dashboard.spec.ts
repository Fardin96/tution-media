import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import {
  adminSessionCookie,
  mockAdminApi,
  type AdminMockOptions,
} from "./admin-mocks";

const DEFAULT_ORDER = [
  "bottleneck",
  "queues",
  "mau",
  "signups",
  "collected",
  "placements",
  "signups-trend",
  "revenue-trend",
];

async function signIn(
  context: BrowserContext,
  options: AdminMockOptions = { adminRole: "SUPER_ADMIN" },
) {
  await context.addCookies([adminSessionCookie]);
  return mockAdminApi(context, options);
}

/** Opens the dashboard and waits until every widget in the saved list has its data. */
async function openDashboard(page: Page, widgets = DEFAULT_ORDER.length) {
  await page.goto("/dashboard/admin");
  await expect(
    page.locator('li[data-widget-id][data-state="ready"]'),
  ).toHaveCount(widgets);
}

function widgetOrder(page: Page) {
  return page
    .locator("li[data-widget-id]")
    .evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-widget-id")),
    );
}

/** Ctrl+K, type a query and press Enter on the first match. */
async function findAndPick(page: Page, query: string) {
  await page.keyboard.press("Control+k");
  const finder = page.getByRole("combobox", { name: "Find a widget or page" });
  await expect(finder).toBeFocused();
  await finder.pressSequentially(query);
  return finder;
}

/** Jumping to a widget scrolls it into view, blinks it and focuses its card. */
async function expectBlinkAndFocus(page: Page, id: string) {
  const li = page.locator(`li#widget-${id}`);
  await expect(li).toBeInViewport();
  await expect.poll(() => li.getAttribute("data-blink")).toBe("");
  await expect(li.locator("[data-widget-card]")).toBeFocused();
  await expect
    .poll(() => li.getAttribute("data-blink"), {
      timeout: 5_000,
    })
    .toBeNull();
}

test.describe("Admin dashboard", () => {
  test("renders the default widgets, the flagged stage and the late queue", async ({
    page,
    context,
  }) => {
    const api = await signIn(context);
    await openDashboard(page);

    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" }),
    ).toBeVisible();
    await expect(
      page.getByText("38%, down 7 pts on the previous 30 days"),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Monthly active users" }),
    ).toBeVisible();
    await expect(page.getByText("Late", { exact: true })).toBeVisible();
    expect(await widgetOrder(page)).toEqual(DEFAULT_ORDER);
    expect(api.unmocked).toEqual([]);
  });

  test("the range control puts ?range= in the URL and reloads the widgets", async ({
    page,
    context,
  }) => {
    const api = await signIn(context);
    await openDashboard(page);
    const before = api.reads.length;
    const widgetReads = () =>
      api.reads
        .slice(before)
        .filter((r) => r.path.startsWith("/admin/dashboard/widgets/"));

    await page.getByRole("radio", { name: "90 days" }).click();

    await expect(page).toHaveURL(/[?&]range=90d$/);
    await expect.poll(() => widgetReads().length).toBeGreaterThan(0);
    for (const read of widgetReads()) {
      expect(read.query).toEqual({ range: "90d" });
    }
    expect(api.unmocked).toEqual([]);
  });

  test("customize saves a new widget, keeps it after reload, and resets", async ({
    page,
    context,
  }) => {
    const api = await signIn(context);
    await openDashboard(page);

    await page.getByRole("button", { name: "Customize" }).click();
    const sheet = page.getByRole("dialog", {
      name: "Customize your dashboard",
    });
    // Turning it on in "Add widgets" appends it to the bottom of "On your dashboard".
    await sheet.getByRole("switch", { name: "Fill rate" }).click();
    const moveUp = sheet.getByRole("button", { name: "Move Fill rate up" });
    // Six moves take it from last (9th) to third, just under "Needs attention".
    for (let i = 0; i < 6; i++) await moveUp.click();
    await sheet.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("Dashboard saved")).toBeVisible();
    await expect(sheet).toBeHidden();
    const saved = [
      "bottleneck",
      "queues",
      "fill-rate",
      ...DEFAULT_ORDER.slice(2),
    ];
    expect(api.writes).toEqual([
      {
        method: "PUT",
        path: "/admin/dashboard/layout",
        body: { widgets: saved },
      },
    ]);

    await page.reload();
    await openDashboard(page, saved.length);
    expect(await widgetOrder(page)).toEqual(saved);

    await page.getByRole("button", { name: "Customize" }).click();
    await page
      .getByRole("dialog", { name: "Customize your dashboard" })
      .getByRole("button", { name: "Reset to default" })
      .click();
    await page
      .getByRole("alertdialog", { name: "Reset your dashboard?" })
      .getByRole("button", { name: "Reset", exact: true })
      .click();

    await expect(
      page.getByText("Dashboard reset to the default"),
    ).toBeVisible();
    expect(api.writes.at(-1)).toEqual({
      method: "DELETE",
      path: "/admin/dashboard/layout",
      body: null,
    });
    await expect(page.locator('li[data-widget-id="fill-rate"]')).toHaveCount(0);
    expect(await widgetOrder(page)).toEqual(DEFAULT_ORDER);
    expect(api.unmocked).toEqual([]);
  });

  test("closing the sheet with unsaved changes asks before discarding", async ({
    page,
    context,
  }) => {
    const api = await signIn(context);
    await openDashboard(page);

    await page.getByRole("button", { name: "Customize" }).click();
    await page
      .getByRole("dialog", { name: "Customize your dashboard" })
      .getByRole("switch", { name: "Fill rate" })
      .click();
    await page.keyboard.press("Escape");

    await expect(
      page.getByRole("alertdialog", { name: "Discard unsaved changes?" }),
    ).toBeVisible();
    expect(api.writes).toEqual([]);
  });

  test("Control+K opens the finder and jumps to a widget that is on the page", async ({
    page,
    context,
  }) => {
    await signIn(context);
    await openDashboard(page);

    const finder = await findAndPick(page, "mau");
    await expect(page.getByRole("option").first()).toContainText(
      "Monthly active users",
    );
    await page.keyboard.press("Enter");

    await expect(finder).toHaveValue("");
    await expectBlinkAndFocus(page, "mau");
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("the finder still jumps, blinks and focuses the widget", async ({
      page,
      context,
    }) => {
      await signIn(context);
      await openDashboard(page);

      await findAndPick(page, "mau");
      await page.keyboard.press("Enter");

      await expectBlinkAndFocus(page, "mau");
    });
  });

  test("adding a widget from the finder saves it and jumps to it", async ({
    page,
    context,
  }) => {
    const api = await signIn(context);
    await openDashboard(page);

    await findAndPick(page, "fill rate");
    const first = page.getByRole("option").first();
    await expect(first).toContainText("Fill rate");
    await expect(first).toContainText("Not on your dashboard");
    await page.keyboard.press("Enter");

    await expect(page.locator('li[data-widget-id="fill-rate"]')).toBeVisible();
    await expectBlinkAndFocus(page, "fill-rate");
    expect(api.writes).toEqual([
      {
        method: "PUT",
        path: "/admin/dashboard/layout",
        body: { widgets: [...DEFAULT_ORDER, "fill-rate"] },
      },
    ]);
  });

  test("the finder opens a page from the admin nav", async ({
    page,
    context,
  }) => {
    await signIn(context);
    await openDashboard(page);

    await findAndPick(page, "refunds");
    await page
      .getByRole("option")
      .filter({ hasText: "Page" })
      .filter({ hasText: "Refunds" })
      .click();

    await expect(page).toHaveURL(/\/dashboard\/admin\/refunds$/);
  });

  test("widget cards are in the saved layout order in the DOM", async ({
    page,
    context,
  }) => {
    await signIn(context);
    await openDashboard(page);

    expect(await widgetOrder(page)).toEqual(DEFAULT_ORDER);
  });

  for (const width of [320, 640]) {
    test(`${width}px wide has no horizontal page scroll`, async ({
      page,
      context,
    }) => {
      await signIn(context);
      await page.setViewportSize({ width, height: 800 });
      await openDashboard(page);

      const fits = await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      );
      expect(fits).toBe(true);
    });
  }
});
