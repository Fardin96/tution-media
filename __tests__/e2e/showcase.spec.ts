import { test, expect, type Locator, type Page } from "@playwright/test";

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

/** Taps the middle of the part of `target` visible inside the strip and the viewport, without scrolling. */
const tapVisiblePart = async (page: Page, target: Locator) => {
  const box = await target.boundingBox();
  const strip = await page.locator("#tutors ul").boundingBox();
  const viewport = page.viewportSize();
  if (!box || !strip || !viewport) throw new Error("card not laid out");
  const left = Math.max(box.x, strip.x, 0);
  const right = Math.min(
    box.x + box.width,
    strip.x + strip.width,
    viewport.width,
  );
  const top = Math.max(box.y, 0);
  const bottom = Math.min(box.y + box.height, viewport.height);
  expect(right - left, "part of the card shows in the strip").toBeGreaterThan(
    8,
  );
  await page.touchscreen.tap((left + right) / 2, (top + bottom) / 2);
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
      // Tap the part of the second card that already shows. A plain tap() scrolls it into the strip
      // first; once that scroll settles the strip hands playback to it, and the tap then pauses it.
      await tapVisiblePart(page, second);
    } else {
      await second.hover();
    }
    await expect.poll(() => playing(page)).toBe("01000000");
    await stripSettled(page);

    // Tap/click the playing card to pause it.
    if (hasTouch) await tapVisiblePart(page, second);
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
