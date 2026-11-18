import { describe, expect, it, vi, beforeEach } from "vitest";
import { apiFetch } from "@/lib/api";
import {
  adminPaymentsApi,
  ATTEMPT_STATUS_META,
  validateNote,
  type AttemptStatus,
} from "@/lib/admin-payments";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Compile-time check: adding a status to the API type makes this object fail to typecheck. */
const ALL_STATUSES: Record<AttemptStatus, true> = {
  PENDING: true,
  SUCCEEDED: true,
  FAILED: true,
  CANCELLED: true,
  EXPIRED: true,
  REVIEW: true,
  UNAPPLIED: true,
};

describe("validateNote", () => {
  it("asks for a note when it is empty or whitespace", () => {
    expect(validateNote("")).toBe("Write a note with at least 3 characters.");
    expect(validateNote("   ")).toBe(
      "Write a note with at least 3 characters.",
    );
  });

  it("needs at least three characters after trimming", () => {
    expect(validateNote("ab")).toBeDefined();
    expect(validateNote("   ab   ")).toBeDefined();
    expect(validateNote("abc")).toBeUndefined();
    expect(validateNote("  abc  ")).toBeUndefined();
  });

  it("allows up to 500 characters and no more", () => {
    expect(validateNote("a".repeat(500))).toBeUndefined();
    expect(validateNote("a".repeat(501))).toBe(
      "Keep the note to 500 characters or fewer.",
    );
  });
});

describe("ATTEMPT_STATUS_META", () => {
  it("covers every attempt status", () => {
    expect(Object.keys(ATTEMPT_STATUS_META).sort()).toEqual(
      Object.keys(ALL_STATUSES).sort(),
    );
  });

  it("gives every status a label, a hint and a known tone", () => {
    const tones = ["neutral", "info", "success", "warning", "error"];
    for (const meta of Object.values(ATTEMPT_STATUS_META)) {
      expect(meta.label).not.toBe("");
      expect(meta.hint).not.toBe("");
      expect(tones).toContain(meta.tone);
    }
  });

  it("flags review as a warning and unapplied as an error", () => {
    expect(ATTEMPT_STATUS_META.REVIEW.tone).toBe("warning");
    expect(ATTEMPT_STATUS_META.UNAPPLIED.tone).toBe("error");
  });
});

describe("adminPaymentsApi.list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiFetch).mockResolvedValue(
      respond({ attempts: [], nextCursor: null }),
    );
  });

  function lastUrl(): URL {
    const [input] = vi.mocked(apiFetch).mock.lastCall ?? [];
    return new URL(String(input), "http://localhost");
  }

  it("sends attention=true only when it is set", async () => {
    await adminPaymentsApi.list({ attention: true });
    expect(lastUrl().pathname).toBe("/api/v1/admin/payment-attempts");
    expect(lastUrl().searchParams.get("attention")).toBe("true");
  });

  it("leaves attention out when it is not set", async () => {
    await adminPaymentsApi.list({});
    expect(lastUrl().searchParams.has("attention")).toBe(false);
  });

  it("sends the status, fee id and cursor when given", async () => {
    await adminPaymentsApi.list(
      { status: "UNAPPLIED", feeId: "11111111-1111-4111-8111-111111111111" },
      "cursor-2",
    );
    const url = lastUrl();
    expect(url.searchParams.get("status")).toBe("UNAPPLIED");
    expect(url.searchParams.get("feeId")).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(url.searchParams.get("cursor")).toBe("cursor-2");
    expect(url.searchParams.has("attention")).toBe(false);
  });
});
