import { test, expect } from "@playwright/test";

test("FAQ: 04 starts open, one answer at a time, keyboard works, View All is inert", async ({
  page,
}) => {
  await page.goto("/");
  const faq = page.locator("#faq");
  await faq.evaluate((el) => el.scrollIntoView({ behavior: "instant" }));
  const triggers = faq.locator("h3 > button");
  const expanded = () =>
    triggers.evaluateAll((bs) =>
      bs
        .map((b) => (b.getAttribute("aria-expanded") === "true" ? 1 : 0))
        .join(""),
    );

  expect(await expanded()).toBe("00010");
  await expect(faq.getByText(/national ID/)).toBeVisible();

  await triggers.nth(0).click();
  await expect.poll(expanded).toBe("10000");

  await triggers.nth(0).click();
  await expect.poll(expanded).toBe("00000");

  await triggers.nth(2).focus();
  await page.keyboard.press("Enter");
  await expect.poll(expanded).toBe("00100");

  const url = page.url();
  await faq.getByRole("button", { name: "View All" }).click();
  expect(page.url()).toBe(url);
});
