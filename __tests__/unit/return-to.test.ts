import { describe, it, expect, beforeEach } from "vitest";
import {
  clearReturnTo,
  popReturnTo,
  readReturnTo,
  setReturnTo,
} from "@/lib/return-to";

const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("setReturnTo and readReturnTo", () => {
  it("keeps an allowed path with a query string", () => {
    setReturnTo("/dashboard/find-tuitions?scope=set", "tuition search");
    expect(readReturnTo()).toMatchObject({
      path: "/dashboard/find-tuitions?scope=set",
      label: "tuition search",
    });
  });

  it("refuses a path that is not on the list", () => {
    setReturnTo("/dashboard/admin", "admin");
    setReturnTo("https://evil.example/dashboard/find-tuitions", "x");
    expect(window.sessionStorage.getItem("returnTo:v1")).toBeNull();
    expect(readReturnTo()).toBeNull();
  });

  it("refuses a stored entry whose path was edited to something else", () => {
    window.sessionStorage.setItem(
      "returnTo:v2",
      JSON.stringify([
        {
          path: "/dashboard/admin",
          label: "admin",
          expiresAt: Date.now() + HOUR,
        },
      ]),
    );
    expect(readReturnTo()).toBeNull();
    expect(window.sessionStorage.getItem("returnTo:v2")).toBeNull();
  });

  it("keeps a valid entry next to a disallowed one", () => {
    window.sessionStorage.setItem(
      "returnTo:v2",
      JSON.stringify([
        {
          path: "/dashboard/admin",
          label: "admin",
          expiresAt: Date.now() + HOUR,
        },
        {
          path: "/dashboard/find-tuitions",
          label: "search",
          expiresAt: Date.now() + HOUR,
        },
      ]),
    );
    expect(readReturnTo()).toMatchObject({ path: "/dashboard/find-tuitions" });
  });

  it("returns null after the 2 hour window", () => {
    setReturnTo("/dashboard/tutor/packages/new", "new package");
    const later = Date.now() + 2 * HOUR + 1000;
    expect(readReturnTo(later)).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    window.sessionStorage.setItem("returnTo:v2", "{oops");
    expect(readReturnTo()).toBeNull();
  });

  it("clearReturnTo removes the entry", () => {
    setReturnTo("/dashboard/requirements/new", "requirement");
    clearReturnTo();
    expect(readReturnTo()).toBeNull();
  });
});

describe("the return trip stack", () => {
  it("returns the newest entry and keeps older ones behind it", () => {
    setReturnTo("/dashboard/find-tuitions", "search");
    setReturnTo("/dashboard/tutor/packages/new", "new package");
    expect(readReturnTo()).toMatchObject({ label: "new package" });
  });

  it("pops the top entry when its page is reached, exposing the one below", () => {
    setReturnTo("/dashboard/find-tuitions", "search");
    setReturnTo("/dashboard/tutor/packages/new", "new package");
    popReturnTo("/dashboard/tutor/packages/new");
    expect(readReturnTo()).toMatchObject({ label: "search" });
  });

  it("does not pop when the path is not the top entry", () => {
    setReturnTo("/dashboard/find-tuitions", "search");
    setReturnTo("/dashboard/tutor/packages/new", "new package");
    popReturnTo("/dashboard/find-tuitions");
    expect(readReturnTo()).toMatchObject({ label: "new package" });
  });

  it("the same page pushed twice refreshes one entry instead of stacking", () => {
    setReturnTo("/dashboard/find-tuitions", "search");
    setReturnTo("/dashboard/find-tuitions", "search");
    popReturnTo("/dashboard/find-tuitions");
    expect(readReturnTo()).toBeNull();
  });

  it("keeps at most three, dropping the oldest", () => {
    setReturnTo("/dashboard/requirements/new", "requirement");
    setReturnTo("/dashboard/tutor/requirements/new", "new requirement set");
    setReturnTo("/dashboard/tutor/packages/new", "new package");
    setReturnTo("/dashboard/find-tuitions", "search");
    popReturnTo("/dashboard/find-tuitions");
    popReturnTo("/dashboard/tutor/packages/new");
    popReturnTo("/dashboard/tutor/requirements/new");
    expect(readReturnTo()).toBeNull();
  });

  it("a nested trip returns through each form in turn", () => {
    setReturnTo("/dashboard/tutor/packages/new", "new package");
    setReturnTo("/dashboard/tutor/requirements/new", "new requirement set");
    expect(readReturnTo()).toMatchObject({ label: "new requirement set" });
    popReturnTo("/dashboard/tutor/requirements/new");
    expect(readReturnTo()).toMatchObject({ label: "new package" });
  });
});
