import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  ACTION_META,
  APPLICATION_ACTIONS,
  APPLICATION_STATUSES,
  STATUS_META,
} from "@/lib/applications";
import { invalidateApplications, queryKeys } from "@/lib/query-keys";

describe("STATUS_META", () => {
  it("has an entry for every application status", () => {
    expect(Object.keys(STATUS_META).sort()).toEqual(
      [...APPLICATION_STATUSES].sort(),
    );
  });

  it("gives each status a label and a tone", () => {
    for (const status of APPLICATION_STATUSES) {
      expect(STATUS_META[status].label).not.toBe("");
      expect(["success", "warning", "error", "neutral", "info"]).toContain(
        STATUS_META[status].tone,
      );
    }
  });

  it("uses the agreed labels", () => {
    expect(STATUS_META.PENDING).toEqual({ label: "Pending", tone: "warning" });
    expect(STATUS_META.REJECTED.label).toBe("Not selected");
    expect(STATUS_META.CANCELLED.tone).toBe("error");
  });
});

describe("ACTION_META", () => {
  it("has an entry for every application action", () => {
    expect(Object.keys(ACTION_META).sort()).toEqual(
      [...APPLICATION_ACTIONS].sort(),
    );
  });

  it("gives each action a label and done copy", () => {
    for (const action of APPLICATION_ACTIONS) {
      expect(ACTION_META[action].label).not.toBe("");
      expect(ACTION_META[action].done).not.toBe("");
    }
  });

  it("confirms accept without making it destructive", () => {
    expect(ACTION_META.confirm.label).toBe("Accept");
    expect(ACTION_META.confirm.confirm).toEqual({
      title: "Accept this application?",
      body: "The other applicants will be told the position is filled. The tutor gets your contact details.",
      confirmLabel: "Accept",
      destructive: false,
    });
  });

  it("confirms decline, withdraw and cancel as destructive", () => {
    expect(ACTION_META.reject.confirm?.destructive).toBe(true);
    expect(ACTION_META.withdraw.confirm?.destructive).toBe(true);
    expect(ACTION_META.cancel.confirm?.destructive).toBe(true);
  });

  it("confirms finishing without making it destructive", () => {
    expect(ACTION_META.complete.label).toBe("Mark as finished");
    expect(ACTION_META.complete.confirm?.destructive).toBe(false);
  });

  it("asks no confirmation for apply again", () => {
    expect(ACTION_META.reopen.label).toBe("Apply again");
    expect(ACTION_META.reopen.confirm).toBeNull();
  });

  it("never uses an exclamation mark in confirmation copy", () => {
    for (const action of APPLICATION_ACTIONS) {
      const confirm = ACTION_META[action].confirm;
      if (!confirm) continue;
      expect(`${confirm.title} ${confirm.body}`).not.toContain("!");
    }
  });
});

describe("application query keys", () => {
  it("list defaults the status to ALL", () => {
    expect(queryKeys.applications.list()).toEqual([
      "applications",
      "list",
      { status: "ALL" },
    ]);
  });

  it("list keeps the status when given", () => {
    expect(queryKeys.applications.list("PENDING")).toEqual([
      "applications",
      "list",
      { status: "PENDING" },
    ]);
  });

  it("detail, requirement and package keys are id-scoped under the all prefix", () => {
    expect(queryKeys.applications.detail("a1")).toEqual([
      "applications",
      "detail",
      "a1",
    ]);
    expect(queryKeys.applications.forRequirement("r1")).toEqual([
      "applications",
      "requirement",
      "r1",
    ]);
    expect(queryKeys.applications.forPackage("p1")).toEqual([
      "applications",
      "package",
      "p1",
    ]);
    expect(queryKeys.applications.detail("a1").slice(0, 1)).toEqual(
      queryKeys.applications.all,
    );
  });
});

describe("invalidateApplications", () => {
  it("invalidates applications, browse, me and notifications", async () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, "invalidateQueries");

    await invalidateApplications(client);

    expect(spy.mock.calls).toEqual([
      [{ queryKey: ["applications"] }],
      [{ queryKey: ["browse"] }],
      [{ queryKey: ["me"] }],
      [{ queryKey: ["notifications"] }],
    ]);
  });
});
