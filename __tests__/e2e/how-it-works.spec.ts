import { test, expect } from "@playwright/test";

test("How it works: switch swaps steps and video; video plays in view and toggles", async ({
  page,
  hasTouch,
}) => {
  await page.goto("/");
  const s = page.locator("#how-it-works");
  // Role query skips the inert, fading-out copy during the cross-fade.
  const video = s.getByRole("button", { name: /^Play video/ });
  const steps = s.locator("[role=tabpanel][data-state=active] li");

  await expect(video).toHaveAttribute("aria-pressed", "false");
  // The video itself must be on screen (on phones it sits below the steps).
  await video.evaluate((el) =>
    el.scrollIntoView({ behavior: "instant", block: "center" }),
  );
  await expect(video).toHaveAttribute("aria-pressed", "true");

  await expect(steps).toHaveCount(3);
  await expect(video).toHaveAccessibleName(/find a tutor/i);

  const become = s.getByRole("tab", { name: "Become a Tutor" });
  await become.evaluate((el) =>
    el.scrollIntoView({ behavior: "instant", block: "center" }),
  );
  if (hasTouch) await become.tap();
  else await become.click();
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(2)).toContainText("Validate your documents");
  await expect(video).toHaveAccessibleName(/become a tutor/i);

  // Tap/click pauses; leaving view keeps it paused.
  await video.evaluate((el) =>
    el.scrollIntoView({ behavior: "instant", block: "center" }),
  );
  if (hasTouch) await video.tap();
  else await video.click();
  await expect(video).toHaveAttribute("aria-pressed", "false");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(video).toHaveAttribute("aria-pressed", "false");
});
