import { describe, it, expect, vi } from "vitest";
import { buildGoogleAuthUrl, getSession } from "@/lib/auth";

const mockCookies = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => mockCookies,
}));

describe("auth helpers", () => {
  describe("buildGoogleAuthUrl", () => {
    it("returns a Google OAuth URL with the required parameters", () => {
      const url = buildGoogleAuthUrl();
      expect(url).toMatch(
        /^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/,
      );

      const parsed = new URL(url);
      expect(parsed.searchParams.get("response_type")).toBe("code");
      expect(parsed.searchParams.get("access_type")).toBe("offline");
      expect(parsed.searchParams.get("prompt")).toBe("consent");
      expect(parsed.searchParams.get("redirect_uri")).toBe(
        `${process.env.NEXT_APP_URL}/api/auth/callback/google`,
      );
      expect(parsed.searchParams.get("client_id")).toBe(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
      );
      const scope = parsed.searchParams.get("scope") ?? "";
      expect(scope).toContain("openid");
      expect(scope).toContain("userinfo.email");
      expect(scope).toContain("userinfo.profile");
    });
  });

  describe("getSession", () => {
    it("returns null when the session cookie is missing", async () => {
      mockCookies.get.mockReturnValue(undefined);
      const session = await getSession();
      expect(session).toBeNull();
    });

    it("returns parsed session data when the cookie is present", async () => {
      const user = { email: "test@example.com", name: "Test User" };
      mockCookies.get.mockReturnValue({ value: JSON.stringify(user) });
      const session = await getSession();
      expect(session).toEqual(user);
    });

    it("returns null when the cookie value is invalid JSON", async () => {
      mockCookies.get.mockReturnValue({ value: "not-json" });
      const session = await getSession();
      expect(session).toBeNull();
    });
  });
});
