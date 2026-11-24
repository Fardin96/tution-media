import { beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { toast } from "sonner";
import { toastError } from "@/lib/toast";
import { ApiError } from "@/lib/profile";
import { PHONE_VERIFY_EVENT } from "@/lib/phone-verify-request";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("toastError", () => {
  it("adds a Verify now action for PHONE_VERIFICATION_REQUIRED and shows the server's message", () => {
    toastError(
      "Couldn't send your request.",
      new ApiError("Verify your phone number before posting.", 403, {
        code: "PHONE_VERIFICATION_REQUIRED",
      }),
    );
    const [message, options] = vi.mocked(toast.error).mock.calls[0];
    expect(message).toBe("Verify your phone number before posting.");
    expect(options).toMatchObject({
      id: "phone-verification-required",
      action: { label: "Verify now" },
    });
  });

  it("the Verify now action dispatches the open event", () => {
    toastError(
      "fallback",
      new ApiError("m", 403, { code: "PHONE_VERIFICATION_REQUIRED" }),
    );
    const [, options] = vi.mocked(toast.error).mock.calls[0];
    const listener = vi.fn();
    window.addEventListener(PHONE_VERIFY_EVENT, listener);
    act(() => {
      (
        options as unknown as { action: { onClick: () => void } }
      ).action.onClick();
    });
    window.removeEventListener(PHONE_VERIFY_EVENT, listener);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("falls back to the catalogue copy when the server sends no message", () => {
    toastError(
      "fallback",
      new ApiError("", 403, { code: "PHONE_VERIFICATION_REQUIRED" }),
    );
    expect(vi.mocked(toast.error).mock.calls[0][0]).toBe(
      "Verify your phone number to continue.",
    );
  });

  it("adds Verify now when PROFILE_INCOMPLETE is only the phone check", () => {
    toastError(
      "Couldn't apply.",
      new ApiError("Finish your profile.", 403, {
        code: "PROFILE_INCOMPLETE",
        details: { missing: ["phone_verification"] },
      }),
    );
    const [message, options] = vi.mocked(toast.error).mock.calls[0];
    expect(message).toBe("Finish your profile first: phone verification.");
    expect(options).toMatchObject({
      id: "phone-verification-required",
      action: { label: "Verify now" },
    });
  });

  it("adds no action when PROFILE_INCOMPLETE also lists other items", () => {
    toastError(
      "Couldn't apply.",
      new ApiError("Finish your profile.", 403, {
        code: "PROFILE_INCOMPLETE",
        details: { missing: ["phone_verification", "default_requirement"] },
      }),
    );
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error).mock.calls[0]).toHaveLength(1);
    expect(vi.mocked(toast.error).mock.calls[0][0]).toBe(
      "Finish your profile first: phone verification, default set with a zone or online teaching.",
    );
  });

  it("adds no action when PROFILE_INCOMPLETE lists a single other item", () => {
    toastError(
      "Couldn't apply.",
      new ApiError("Finish your profile.", 403, {
        code: "PROFILE_INCOMPLETE",
        details: { missing: ["default_requirement"] },
      }),
    );
    expect(vi.mocked(toast.error).mock.calls[0]).toHaveLength(1);
  });

  it("leaves other errors unchanged", () => {
    toastError(
      "Couldn't save.",
      new ApiError("Nope", 403, { code: "FORBIDDEN" }),
    );
    expect(toast.error).toHaveBeenCalledWith("You don't have access to this.");
    expect(vi.mocked(toast.error).mock.calls[0]).toHaveLength(1);
  });

  it("uses the fallback for an unknown error", () => {
    toastError("Couldn't save.", new Error("boom"));
    expect(toast.error).toHaveBeenCalledWith("Couldn't save.");
  });
});
