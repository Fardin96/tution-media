import { test, expect, type Page } from "@playwright/test";

const playing = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("#tutors button[aria-pressed]")]
      .map((b) => (b.getAttribute("aria-pressed") === "true" ? 1 : 0))
      .join(""),
  );

// Taps can scroll the strip (scroll-snap then settles); wait so the next tap
// doesn't land on a moving card.
const stripSettled = async (page: Page) => {
  let last = -1;
  await expect
    .poll(async () => {
      const now = await page
        .locator("#tutors ul")
        .evaluate((el) => Math.round(el.scrollLeft));
      const still = now === last;
      last = now;
      return still;
    })
    .toBe(true);
};

test.describe("Tutor showcase", () => {
  test("first video plays in view, hover/tap switch it, leaving view pauses all", async ({
    page,
    hasTouch,
  }) => {
    await page.goto("/");
    expect(await playing(page)).not.toContain("1");

    await page
      .locator("#tutors")
      .evaluate((el) => el.scrollIntoView({ behavior: "instant" }));
    await expect.poll(() => playing(page)).toBe("10000000");

    const second = page.locator("#tutors ul > li").nth(1).locator("button");
    if (hasTouch) {
      await second.tap();
    } else {
      await second.hover();
    }
    await expect.poll(() => playing(page)).toBe("01000000");
    await stripSettled(page);

    // Tap/click the playing card to pause it.
    if (hasTouch) await second.tap();
    else await second.click();
    await expect.poll(() => playing(page)).toBe("00000000");

    // Back in view after leaving: autoplay starts again from the first visible.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect.poll(() => playing(page)).toBe("00000000");
  });

  test("arrows page the strip and disable at the ends", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 640, "phones swipe");
    await page.goto("/");
    await page
      .locator("#tutors")
      .evaluate((el) => el.scrollIntoView({ behavior: "instant" }));
    const prev = page.getByRole("button", { name: "Previous tutors" });
    const next = page.getByRole("button", { name: "Next tutors" });
    await expect(prev).toBeDisabled();
    await next.click();
    await expect(prev).toBeEnabled();
    for (let i = 0; i < 12 && (await next.isEnabled()); i++) {
      await next.click();
      await page.waitForTimeout(500);
    }
    await expect(next).toBeDisabled();
  });
});
