import { test, expect, type Page } from "@playwright/test";

const slideLabel = (page: Page) =>
  page.locator("#testimonials [aria-live] > .sr-only");
const visibleFace = (page: Page) =>
  page.locator("#testimonials div[aria-hidden=false]");

test.describe("Testimonials", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page
      .locator("#testimonials")
      .evaluate((el) => el.scrollIntoView({ behavior: "instant" }));
  });

  test("arrows step and wrap, the card flips and resets on slide change", async ({
    page,
  }) => {
    await expect(slideLabel(page)).toHaveText("Testimonial 1 of 6");

    await visibleFace(page)
      .getByRole("button", { name: "Previous testimonial" })
      .click();
    await expect(slideLabel(page)).toHaveText("Testimonial 6 of 6");

    await visibleFace(page)
      .getByRole("button", { name: "Next testimonial" })
      .click();
    await expect(slideLabel(page)).toHaveText("Testimonial 1 of 6");

    // Flip to the full comment, then go back to the front.
    await visibleFace(page).locator("button[aria-expanded=false]").click();
    await expect(
      visibleFace(page).locator("button[aria-expanded=true]"),
    ).toBeVisible();
    const backNext = visibleFace(page).getByRole("button", {
      name: "Next testimonial",
    });
    if (await backNext.isVisible()) {
      // sm+: arrows on the back change slide and return to the front.
      await backNext.click();
      await expect(slideLabel(page)).toHaveText("Testimonial 2 of 6");
    } else {
      // Phones: the back has no arrows (keeps the card short); tap flips back.
      await visibleFace(page).locator("button[aria-expanded=true]").click();
      await expect(slideLabel(page)).toHaveText("Testimonial 1 of 6");
    }
    await expect(
      visibleFace(page).locator("button[aria-expanded=false]"),
    ).toBeVisible();
  });

  test("swiping changes slides on touch devices without flipping", async ({
    page,
    hasTouch,
    context,
  }) => {
    test.skip(!hasTouch, "touch only");
    const box = (await visibleFace(page).boundingBox())!;
    const cdp = await context.newCDPSession(page);
    const x = box.x + box.width / 2;
    const y = box.y + 60;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 8; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x - i * 20, y }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });

    await expect(slideLabel(page)).toHaveText("Testimonial 2 of 6");
    await expect(
      visibleFace(page).locator("button[aria-expanded=false]"),
    ).toBeVisible();

    // A swipe must not swallow the next real tap.
    await visibleFace(page).locator("button[aria-expanded=false]").tap();
    await expect(
      visibleFace(page).locator("button[aria-expanded=true]"),
    ).toBeVisible();
  });
});
