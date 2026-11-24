import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { getStoredTokens } from "@/lib/api";
import { refreshMyTutorProfile } from "@/lib/tutor-profile.actions";
import {
  invalidatePhoneVerification,
  invalidateTutorRequirements,
} from "@/lib/query-keys";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getStoredTokens: vi.fn(),
}));

vi.mock("@/lib/tutor-profile.actions", () => ({
  refreshMyTutorProfile: vi.fn(async () => true),
}));

const SIGNED_IN = { accessToken: "token-1" } as ReturnType<
  typeof getStoredTokens
>;

/** The refresh is fire-and-forget, so let its microtask run before asserting that it did not. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("public tutor profile refresh on owner changes", () => {
  it("refreshes the signed-in tutor's public profile when a phone is verified", async () => {
    vi.mocked(getStoredTokens).mockReturnValue(SIGNED_IN);

    await invalidatePhoneVerification(new QueryClient());

    await vi.waitFor(() =>
      expect(refreshMyTutorProfile).toHaveBeenCalledWith("token-1"),
    );
  });

  it("does not refresh when nobody is signed in", async () => {
    vi.mocked(getStoredTokens).mockReturnValue(null);

    await invalidatePhoneVerification(new QueryClient());
    await settle();

    expect(refreshMyTutorProfile).not.toHaveBeenCalled();
  });

  it("refreshes when a tutor requirement set changes, since the default set counts toward the badge", async () => {
    vi.mocked(getStoredTokens).mockReturnValue(SIGNED_IN);

    await invalidateTutorRequirements(new QueryClient());

    await vi.waitFor(() =>
      expect(refreshMyTutorProfile).toHaveBeenCalledWith("token-1"),
    );
  });
});
