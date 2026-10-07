import { test, expect } from "@playwright/test";

test.describe("Categories section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("tablist", { name: "Subject categories" })
      .evaluate((el) =>
        el.scrollIntoView({ block: "center", behavior: "instant" }),
      );
  });

  // Regression: popLayout without a positioned list threw the page to the top on touch.
  test("switching category keeps the scroll position and filters cards", async ({
    page,
    hasTouch,
  }) => {
    for (const name of ["Physics", "Art", "All"]) {
      const tab = page.getByRole("tab", { name, exact: true });
      await tab.evaluate((el) =>
        el.scrollIntoView({
          block: "nearest",
          inline: "center",
          behavior: "instant",
        }),
      );
      const before = await page.evaluate(() => Math.round(scrollY));
      if (hasTouch) await tab.tap();
      else await tab.click();
      await expect(tab).toHaveAttribute("data-state", "active");
      // Let the exit/enter animation finish before measuring.
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => Math.round(scrollY))).toBe(before);

      const cards = page
        .getByRole("list", { name: "Tutors" })
        .getByRole("button");
      if (name !== "All") {
        for (const card of await cards.all()) {
          await expect(card).toContainText(name);
        }
      } else {
        await expect(cards).toHaveCount(8);
      }
    }
  });
});
