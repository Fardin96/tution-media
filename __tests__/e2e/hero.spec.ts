import { test, expect } from "@playwright/test";
import sharp from "sharp";

test.describe("Hero section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000");
  });

  test("hero spacing matches design tokens at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const nav = page.locator("header nav");
    const tagline = page.getByTestId("chip");
    const heading = page.locator("h1");
    const paragraph = page.locator("section > p");
    // SearchBar's className lands on its wrapper div, not the form.
    const searchWrapper = page.locator("form[role=search]").locator("..");

    const navBottom = await nav.evaluate(
      (el) => el.getBoundingClientRect().bottom,
    );
    const tagTop = await tagline.evaluate(
      (el) => el.getBoundingClientRect().top,
    );

    // Section padding-top drives the first gap; margins drive the rest.
    expect(tagTop - navBottom).toBeCloseTo(45, 0);
    expect(await heading.evaluate((el) => getComputedStyle(el).marginTop)).toBe(
      "16px",
    );
    expect(
      await paragraph.evaluate((el) => getComputedStyle(el).marginTop),
    ).toBe("16px");
    expect(
      await searchWrapper.evaluate((el) => getComputedStyle(el).marginTop),
    ).toBe("37px");
  });

  test("search bar is inline on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const button = page.locator("form[role=search] button[type=submit]");
    const input2 = page.locator("input[name=location]");
    const buttonBox = await button.boundingBox();
    const input2Box = await input2.boundingBox();
    expect(buttonBox!.y).toBeCloseTo(input2Box!.y, 0);
  });

  test("search bar stacks on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const button = page.locator("form[role=search] button[type=submit]");
    const formBox = await page.locator("form[role=search]").boundingBox();
    const btnBox = await button.boundingBox();
    // Button fills nearly the full form width on mobile.
    expect(btnBox!.width).toBeGreaterThan(formBox!.width * 0.9);
  });

  test("photo row fills viewport edges on desktop", async ({ page }) => {
    for (const width of [1440, 1920, 2560, 3840]) {
      await page.setViewportSize({ width, height: 1000 });
      const cards = page.locator("section ul > li");
      const first = await cards.first().boundingBox();
      const last = await cards.last().boundingBox();
      expect(first!.x).toBeLessThanOrEqual(0);
      expect(last!.x + last!.width).toBeGreaterThanOrEqual(width);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    }
  });

  test("nav link contrast against rendered mesh is at least 4.5:1", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const link = page.locator("header nav a").first();
    const box = await link.boundingBox();
    const screenshot = await page.screenshot();
    const { data, info } = await sharp(screenshot)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const lin = (c: number) =>
      c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const L = (r: number, g: number, b: number) =>
      0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);

    const fgRgb = await link.evaluate((el) => {
      const m = getComputedStyle(el).color.match(/\d+/g)!;
      return m.map(Number);
    });

    let maxBg = 0;
    for (let y = Math.floor(box!.y); y < box!.y + box!.height; y += 4) {
      for (let x = Math.floor(box!.x); x < box!.x + box!.width; x += 4) {
        const i = (y * info.width + x) * 3;
        const l = L(data[i], data[i + 1], data[i + 2]);
        if (l > maxBg) maxBg = l;
      }
    }

    const fg = L(fgRgb[0], fgRgb[1], fgRgb[2]);
    const contrast =
      (Math.max(fg, maxBg) + 0.05) / (Math.min(fg, maxBg) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });

  test("hero image assets load with HTTP 200", async ({ page }) => {
    const paths = [
      "/assets/avatar-demo/Photo-Frame-1.png",
      "/assets/avatar-demo/Photo-Frame-2.png",
      "/assets/avatar-demo/Photo-Frame-3.png",
      "/assets/avatar-demo/Photo-Frame-4.png",
      "/assets/ic/ic-search.png",
      "/assets/ic/ic-pin-map.png",
      "/assets/ic/ic-briefcase.png",
      "/assets/ic-demo/Icon.png",
      "/assets/hero-bg.png",
    ];
    for (const src of paths) {
      const res = await page.request.get(src);
      expect(res.status(), `${src} failed`).toBe(200);
    }
  });
});
