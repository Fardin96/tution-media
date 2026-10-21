import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { api } from "@/lib/api";
import {
  GoogleSignInButton,
  NO_ACCOUNT,
} from "@/components/auth/google-sign-in-button";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// Fire onReady immediately instead of loading the real Google script.
vi.mock("next/script", () => ({
  default: ({ onReady }: { onReady: () => void }) => {
    queueMicrotask(onReady);
    return null;
  },
}));

let callback: (r: { credential: string }) => Promise<void>;

beforeEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
  window.google = {
    accounts: {
      id: {
        initialize: (c) => {
          callback = c.callback as typeof callback;
        },
        renderButton: () => {},
      },
    },
  };
});

const fakeJwt = `x.${btoa(JSON.stringify({ name: "A", picture: "p" }))}.y`;

describe("GoogleSignInButton", () => {
  it("sign-in sends no role and explains a missing account", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue(new Response("{}", { status: 404 }));
    const onError = vi.fn();
    render(
      <GoogleSignInButton clientId="id" mode="sign-in" onError={onError} />,
    );
    await waitFor(() => expect(callback).toBeDefined());

    await callback({ credential: fakeJwt });

    expect(post).toHaveBeenCalledWith("/api/v1/auth/google", {
      idToken: fakeJwt,
      role: undefined,
    });
    expect(JSON.stringify(post.mock.calls[0][1])).not.toContain("role");
    expect(onError).toHaveBeenCalledWith(NO_ACCOUNT);
    expect(push).not.toHaveBeenCalled();
  });

  it("sign-up sends the chosen role", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue(new Response("{}", { status: 500 }));
    render(
      <GoogleSignInButton
        clientId="id"
        mode="sign-up"
        role="TUTOR"
        onError={() => {}}
      />,
    );
    await waitFor(() => expect(callback).toBeDefined());

    await callback({ credential: fakeJwt });

    expect(post.mock.calls[0][1]).toEqual({ idToken: fakeJwt, role: "TUTOR" });
  });
});
