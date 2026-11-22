import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

/** The visible button is aria-hidden while the Google overlay is live, so look it up by its label. */
function googleButton() {
  return screen.getByText("Continue with Google").closest("button")!;
}

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

  it("shows a blocking status while signing in and clears it after a 404", async () => {
    let finish!: (r: Response) => void;
    vi.mocked(apiFetch).mockReturnValue(
      new Promise<Response>((resolve) => (finish = resolve)),
    );
    const onError = vi.fn();
    render(
      <GoogleSignInButton clientId="id" mode="sign-in" onError={onError} />,
    );
    await waitFor(() => expect(callback).toBeDefined());

    const pending = callback!({ credential: fakeJwt });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Signing you in…"),
    );
    expect(googleButton()).toBeDisabled();

    finish(new Response("{}", { status: 404 }));
    await pending;

    await waitFor(() =>
      expect(screen.getByRole("status")).not.toHaveTextContent(
        "Signing you in…",
      ),
    );
    expect(googleButton()).toBeEnabled();
    expect(onError).toHaveBeenCalledWith(NO_ACCOUNT);
  });

  it("ignores a second Google callback while one is running", async () => {
    let finish!: (r: Response) => void;
    vi.mocked(apiFetch).mockReturnValue(
      new Promise<Response>((resolve) => (finish = resolve)),
    );
    render(
      <GoogleSignInButton clientId="id" mode="sign-in" onError={vi.fn()} />,
    );
    await waitFor(() => expect(callback).toBeDefined());

    const first = callback!({ credential: fakeJwt });
    await callback!({ credential: fakeJwt });

    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    finish(new Response("{}", { status: 404 }));
    await first;
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
