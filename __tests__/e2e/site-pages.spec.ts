import { test, expect } from "@playwright/test";

// The API may be down here, so the pages fall back to the bundled default titles.
const pages = [
  { path: "/about-us", title: "About Us" },
  { path: "/terms", title: "Terms and Conditions" },
  { path: "/privacy", title: "Privacy Policy" },
  { path: "/contact", title: "Contact Support" },
];

for (const { path, title } of pages) {
  test(`${path} shows its heading and has no horizontal scroll at 320px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: title }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(overflow).toBe(false);
  });
}
