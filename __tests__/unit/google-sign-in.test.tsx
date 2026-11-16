import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { apiFetch } from "@/lib/api";
import {
  GoogleSignInButton,
  NO_ACCOUNT,
} from "@/components/auth/google-sign-in-button";

// The typed client sends through apiFetch, so mock that and leave the rest of the module real.
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
// Fire onReady immediately instead of loading the real Google script.
vi.mock("next/script", () => ({
  default: ({ onReady }: { onReady: () => void }) => {
    queueMicrotask(onReady);
    return null;
  },
}));

let callback: ((r: { credential: string }) => Promise<void>) | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  push.mockReset();
  // Each test must wait for its own component's callback, not the previous one.
  callback = undefined;
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

/** The JSON body the component sent to POST /api/v1/auth/google. */
function sentBody(): unknown {
  const [, init] = vi.mocked(apiFetch).mock.calls[0];
  return JSON.parse(String(init?.body));
}

describe("GoogleSignInButton", () => {
  it("sign-in sends no role and explains a missing account", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 404 }));
    const onError = vi.fn();
    render(
      <GoogleSignInButton clientId="id" mode="sign-in" onError={onError} />,
    );
    await waitFor(() => expect(callback).toBeDefined());

    await callback!({ credential: fakeJwt });

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/auth\/google$/),
      expect.objectContaining({ method: "POST" }),
    );
    expect(sentBody()).toEqual({ idToken: fakeJwt });
    expect(JSON.stringify(sentBody())).not.toContain("role");
    expect(onError).toHaveBeenCalledWith(NO_ACCOUNT);
    expect(push).not.toHaveBeenCalled();
  });

  it("sign-up sends the chosen role", async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response("{}", { status: 500 }));
    const onError = vi.fn();
    render(
      <GoogleSignInButton
        clientId="id"
        mode="sign-up"
        role="TUTOR"
        onError={onError}
      />,
    );
    await waitFor(() => expect(callback).toBeDefined());

    await callback!({ credential: fakeJwt });

    expect(sentBody()).toEqual({ idToken: fakeJwt, role: "TUTOR" });
    expect(onError).toHaveBeenCalledWith("Authentication failed (500)");
  });

  it("reports the API error message when sign-in is refused", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Forbidden",
          code: "FORBIDDEN",
          message: "This account is blocked.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );
    const onError = vi.fn();
    render(
      <GoogleSignInButton clientId="id" mode="sign-in" onError={onError} />,
    );
    await waitFor(() => expect(callback).toBeDefined());

    await callback!({ credential: fakeJwt });

    expect(onError).toHaveBeenCalledWith("This account is blocked.");
    expect(push).not.toHaveBeenCalled();
  });
});
