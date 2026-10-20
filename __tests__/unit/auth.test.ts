import { describe, it, expect, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth";
import { getSession, requireSession, signOut } from "@/lib/auth.server";

const mockCookies = vi.hoisted(() => ({ get: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => mockCookies,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
}));

describe("auth helpers", () => {
  describe("getSession", () => {
    it("returns null when the session cookie is missing", async () => {
      mockCookies.get.mockReturnValue(undefined);
      const session = await getSession();
      expect(session).toBeNull();
    });

    it("returns parsed session data when the cookie is present", async () => {
      const user = {
        id: "acc_1",
        email: "test@example.com",
        name: "Test User",
        role: "STUDENT",
      };
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

  describe("requireSession", () => {
    it("redirects to sign in when the session cookie is missing", async () => {
      mockCookies.get.mockReturnValue(undefined);
      await expect(requireSession()).rejects.toThrow("redirect:/sign-in");
    });

    it("returns the session when the cookie is present", async () => {
      const user = {
        id: "acc_1",
        email: "test@example.com",
        name: "Test User",
        role: "TUTOR",
      };
      mockCookies.get.mockReturnValue({ value: JSON.stringify(user) });
      const session = await requireSession();
      expect(session).toEqual(user);
    });
  });

  describe("signOut", () => {
    it("deletes the session cookie and redirects", async () => {
      await expect(signOut()).rejects.toThrow("redirect:/sign-in");
      expect(mockCookies.delete).toHaveBeenCalledWith(SESSION_COOKIE);
    });
  });
});
