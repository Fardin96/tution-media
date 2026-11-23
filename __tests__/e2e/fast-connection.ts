import type { BrowserContext } from "@playwright/test";

/**
 * Pins navigator.connection to a fast link without data saving. Chrome estimates effectiveType
 * from measured round trips, so a busy local dev server (the full suite, the pre-push hook) can
 * read as "3g", and useSaveData() then turns autoplay off, which is right for users but makes
 * autoplay specs flaky.
 */
export async function pinFastConnection(context: BrowserContext) {
  await context.addInitScript(() => {
    const connection = Object.assign(new EventTarget(), {
      effectiveType: "4g",
      saveData: false,
    });
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      get: () => connection,
    });
  });
}
