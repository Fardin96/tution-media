import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { ApiError, parseJson } from "@/lib/profile";
import { errorCodeMessage } from "@/lib/api-errors";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status });

// parseJson always rejects on the error paths exercised here; this returns the rejection typed as ApiError.
const rejectionOf = (p: Promise<unknown>): Promise<ApiError> =>
  p.then(
    () => {
      throw new Error("expected parseJson to reject");
    },
    (e: ApiError) => e,
  );

describe("ApiError", () => {
  it("works with only message and status", () => {
    const err = new ApiError("m", 409);
    expect(err.status).toBe(409);
    expect(err.code).toBeUndefined();
    expect(err.details).toBeUndefined();
    expect(err.issues).toBeUndefined();
  });

  it("exposes code and details and is an Error and an ApiError", () => {
    const err = new ApiError("m", 409, {
      code: "REQUIREMENT_LOSES_LAST_SUBJECT",
      details: { requirementIds: ["a"], packageIds: ["p"] },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("m");
    expect(err.code).toBe("REQUIREMENT_LOSES_LAST_SUBJECT");
    expect(err.details).toEqual({ requirementIds: ["a"], packageIds: ["p"] });
  });
});

describe("parseJson", () => {
  it("keeps code, details and message from the error body", async () => {
    const err = await rejectionOf(
      parseJson(
        json(409, {
          error: "RequirementLosesLastSubject",
          code: "REQUIREMENT_LOSES_LAST_SUBJECT",
          message: "Removing this subject would leave a package with none",
          details: { requirementIds: [], packageIds: ["p1"] },
        }),
      ),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 409,
      code: "REQUIREMENT_LOSES_LAST_SUBJECT",
      details: { requirementIds: [], packageIds: ["p1"] },
      message: "Removing this subject would leave a package with none",
    });
  });

  it("keeps validation issues on a 400", async () => {
    const issues = [
      { path: ["subjectIds"], message: "At least one subject is required" },
    ];
    const err = await rejectionOf(
      parseJson(
        json(400, {
          error: "ValidationError",
          code: "VALIDATION_ERROR",
          issues,
        }),
      ),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.issues).toEqual(issues);
  });

  it("maps a duplicate phone number to the friendly message", async () => {
    const err = await rejectionOf(
      parseJson(
        json(409, { error: "PhoneInUse", code: "PHONE_IN_USE", message: "x" }),
      ),
    );
    expect(err.message).toBe(
      "Phone number is already in use, please use a different one.",
    );
    expect(err.code).toBe("PHONE_IN_USE");
  });

  it("maps a duplicate WhatsApp number to the friendly message", async () => {
    const err = await rejectionOf(
      parseJson(json(409, { error: "WhatsappInUse", message: "x" })),
    );
    expect(err.message).toBe(
      "WhatsApp number is already in use, please use a different one.",
    );
  });

  it("gives the session-expired message on 401", async () => {
    const err = await rejectionOf(parseJson(json(401, { message: "nope" })));
    expect(err.message).toBe("Your session has expired. Sign in again.");
  });

  it("gives the server-error message on 500", async () => {
    const err = await rejectionOf(parseJson(json(500, { message: "boom" })));
    expect(err.message).toMatch(/^Something went wrong on our side\./);
  });

  it("falls back to a status message when the body is not JSON", async () => {
    const err = await rejectionOf(
      parseJson(new Response("oops", { status: 418 })),
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("Request failed (418).");
    expect(err.code).toBeUndefined();
  });
});

describe("DAILY_LIMIT_REACHED copy", () => {
  // 25 Nov 2026, 08:00 in Asia/Dhaka (UTC+6, no DST).
  const NOW = new Date("2026-11-25T02:00:00Z");
  const limit = (details?: Record<string, unknown>) =>
    errorCodeMessage(
      new ApiError("You can send 50 applications in 24 hours.", 429, {
        code: "DAILY_LIMIT_REACHED",
        details,
      }),
    );

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the server's message and the Dhaka time for a reset today", () => {
    expect(limit({ limit: 50, resetsAt: "2026-11-25T10:15:00Z" })).toBe(
      "You can send 50 applications in 24 hours. You can try again after 4:15 pm.",
    );
  });

  it("adds the date when the reset is not today in Dhaka", () => {
    expect(limit({ limit: 50, resetsAt: "2026-11-26T10:15:00Z" })).toBe(
      "You can send 50 applications in 24 hours. You can try again after 4:15 pm on 26 Nov.",
    );
  });

  it("leaves the time out when resetsAt is not a date", () => {
    expect(limit({ limit: 50, resetsAt: "soon" })).toBe(
      "You can send 50 applications in 24 hours.",
    );
    expect(limit({ limit: 50 })).toBe(
      "You can send 50 applications in 24 hours.",
    );
  });
});
