import { test, expect, type Locator, type Page } from "@playwright/test";
import { areasMock, subjectsMock } from "./profile-mocks";

async function mockLookups(page: Page) {
  await page.route("**/api/v1/subjects", (route) =>
    route.fulfill({ json: subjectsMock }),
  );
  await page.route("**/api/v1/areas", (route) =>
    route.fulfill({ json: areasMock }),
  );
}

const subject = (page: Page) =>
  page.getByRole("combobox", { name: "Skill or role" });
const location = (page: Page) =>
  page.getByRole("combobox", { name: "Location" });
const search = (page: Page) => page.getByRole("button", { name: "Search" });
const form = (page: Page) => page.locator("form[role=search]");
const listbox = (page: Page, name: string) =>
  page.getByRole("listbox", { name });

/** True when the element at the centre of `target` is `target` or one of its descendants. */
async function hitsCentreOf(target: Locator): Promise<boolean> {
  const box = await target.boundingBox();
  if (!box) throw new Error("target has no box");
  return target.evaluate(
    (el, point) => {
      const hit = document.elementFromPoint(point.x, point.y);
      return !!hit && (el === hit || el.contains(hit));
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );
}

test.describe("hero search suggestions", () => {
  test.beforeEach(async ({ page }) => {
    await mockLookups(page);
  });

  test("on a phone, the subject popup opens below the whole form and covers neither field nor Search", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    await form(page).scrollIntoViewIfNeeded();

    await subject(page).click();
    await subject(page).pressSequentially("m");
    const list = listbox(page, "Subject suggestions");
    await expect(list).toBeVisible();

    await expect(location(page)).toBeVisible();
    expect(await hitsCentreOf(location(page))).toBe(true);
    expect(await hitsCentreOf(search(page))).toBe(true);

    // Opens below Search, so the popup can't sit over any control in the form.
    await expect(async () => {
      const listTop = (await list.boundingBox())?.y ?? 0;
      const searchBottom = (await search(page).boundingBox())?.y ?? 0;
      const searchHeight = (await search(page).boundingBox())?.height ?? 0;
      expect(listTop).toBeGreaterThanOrEqual(searchBottom + searchHeight);
    }).toPass();
  });

  test("on a desktop, the subject popup lines up with the subject field's left edge", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    await subject(page).click();
    await subject(page).pressSequentially("m");
    const list = listbox(page, "Subject suggestions");
    await expect(list).toBeVisible();

    // The subject field is the form's first child: the popup's containing block.
    const field = form(page).locator(":scope > div").first();
    await expect(async () => {
      const fieldLeft = (await field.boundingBox())?.x ?? 0;
      const listLeft = (await list.boundingBox())?.x ?? 0;
      expect(Math.abs(listLeft - fieldLeft)).toBeLessThanOrEqual(2);
    }).toPass();
  });

  test("Escape hides the listbox", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    await subject(page).click();
    await subject(page).pressSequentially("m");
    await expect(listbox(page, "Subject suggestions")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(listbox(page, "Subject suggestions")).toHaveCount(0);
  });
});
