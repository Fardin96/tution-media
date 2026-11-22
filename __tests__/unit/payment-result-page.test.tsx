import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PaymentResultPage } from "@/components/fees/payment-result-page";
import { apiFetch } from "@/lib/api";
import type { PaymentAttemptView } from "@/lib/fees";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const FEE_ID = "fee-1";
const TRAN = "TUT-20261118-ABC123";
const GATEWAY_URL = "https://sandbox.sslcommerz.com/gw/session-1";

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function attempt(
  overrides: Partial<PaymentAttemptView> = {},
): PaymentAttemptView {
  return {
    tranId: TRAN,
    status: "FAILED",
    feeAmount: "1000.00",
    chargeAmount: "25.00",
    totalAmount: "1025.00",
    failureReason: null,
    createdAt: "2026-11-18T04:00:00.000Z",
    settledAt: null,
    fee: {
      status: "DUE",
      amountDue: "1000.00",
      amountPaid: "0.00",
      remaining: "1000.00",
    },
    ...overrides,
  };
}

/** Answers the attempt read with `view` and the checkout POST with a gateway session. */
function mockApi(view: PaymentAttemptView | { status: number }) {
  vi.mocked(apiFetch).mockImplementation(async (input, init) => {
    const { pathname } = new URL(input, "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    if (pathname === `/api/v1/fees/${FEE_ID}/attempts/${TRAN}`) {
      if ("status" in view && !("tranId" in view)) {
        return respond({ message: "Not found" }, view.status);
      }
      return respond(view);
    }
    if (pathname === `/api/v1/fees/${FEE_ID}/checkout` && method === "POST") {
      return respond(
        {
          tranId: "TUT-NEW",
          gatewayUrl: GATEWAY_URL,
          feeAmount: "1000.00",
          chargeAmount: "25.00",
          totalAmount: "1025.00",
        },
        201,
      );
    }
    return respond({ message: "Not mocked" }, 404);
  });
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <PaymentResultPage feeId={FEE_ID} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = `tran=${TRAN}`;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PaymentResultPage headings", () => {
  it.each([
    ["PENDING", "Confirming your payment"],
    ["SUCCEEDED", "Payment received"],
    ["FAILED", "Payment didn't go through"],
    ["CANCELLED", "Payment cancelled"],
    ["EXPIRED", "Payment session expired"],
    ["REVIEW", "We're checking this payment"],
    ["UNAPPLIED", "Payment received, but not applied"],
  ] as const)(
    "shows the %s heading inside the live region",
    async (status, heading) => {
      mockApi(attempt({ status }));
      renderPage();

      const title = await screen.findByRole("heading", { name: heading });
      expect(title.closest('[aria-live="polite"]')).toBeInTheDocument();
    },
  );
});

describe("SUCCEEDED", () => {
  it("shows the split with the processing charge", async () => {
    mockApi(
      attempt({
        status: "SUCCEEDED",
        fee: {
          status: "PAID",
          amountDue: "1000.00",
          amountPaid: "1000.00",
          remaining: "0.00",
        },
      }),
    );
    renderPage();

    expect(
      await screen.findByText(
        "You paid ৳1,025.00. ৳1,000.00 went to your placement fee and ৳25.00 covered the processing charge.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("This fee is fully paid.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View fee" })).toHaveAttribute(
      "href",
      `/dashboard/fees/${FEE_ID}`,
    );
    expect(screen.getByRole("link", { name: "All fees" })).toHaveAttribute(
      "href",
      "/dashboard/fees",
    );
  });

  it("omits the charge sentence when there is none and shows what is still due", async () => {
    mockApi(
      attempt({
        status: "SUCCEEDED",
        chargeAmount: "0.00",
        totalAmount: "500.00",
        feeAmount: "500.00",
        fee: {
          status: "PARTIAL",
          amountDue: "1000.00",
          amountPaid: "500.00",
          remaining: "500.00",
        },
      }),
    );
    renderPage();

    expect(
      await screen.findByText(
        "You paid ৳500.00. ৳500.00 went to your placement fee.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/processing charge/)).not.toBeInTheDocument();
    expect(screen.getByText("৳500.00 is still due.")).toBeInTheDocument();
  });
});

describe("Try again", () => {
  it("shows only while the fee is still open", async () => {
    mockApi(attempt({ status: "FAILED" }));
    const { unmount } = renderPage();
    expect(
      await screen.findByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
    unmount();

    mockApi(
      attempt({
        status: "FAILED",
        fee: {
          status: "PAID",
          amountDue: "1000.00",
          amountPaid: "1000.00",
          remaining: "0.00",
        },
      }),
    );
    renderPage();
    await screen.findByRole("heading", { name: "Payment didn't go through" });
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("starts a checkout and sends the browser to the gateway", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    mockApi(attempt({ status: "CANCELLED" }));
    renderPage();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(GATEWAY_URL));
    const checkoutPosts = vi
      .mocked(apiFetch)
      .mock.calls.filter(
        ([input, init]) =>
          new URL(input, "http://localhost").pathname ===
            `/api/v1/fees/${FEE_ID}/checkout` && init?.method === "POST",
      );
    expect(checkoutPosts).toHaveLength(1);
  });
});

describe("Try again while redirecting", () => {
  it("keeps Try again off and shows the redirect once the session is made", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    mockApi(attempt({ status: "CANCELLED" }));
    renderPage();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Try again" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(GATEWAY_URL));
    const status = await screen.findByText("Taking you to SSLCommerz…");
    expect(status.closest('[role="status"]')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Starting/ })).toBeDisabled();
  });

  it("releases Try again when the page is restored from the back-forward cache", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    mockApi(attempt({ status: "CANCELLED" }));
    renderPage();

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Try again" }));
    await screen.findByText("Taking you to SSLCommerz…");

    act(() => {
      const event = new Event("pageshow");
      Object.defineProperty(event, "persisted", { value: true });
      window.dispatchEvent(event);
    });

    await waitFor(() =>
      expect(
        screen.queryByText("Taking you to SSLCommerz…"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});

describe("missing payment", () => {
  it("shows the not-found copy when there is no tran in the URL", async () => {
    nav.search = "";
    mockApi(attempt());
    renderPage();

    expect(
      await screen.findByRole("heading", {
        name: "We couldn't find this payment.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the fee" })).toHaveAttribute(
      "href",
      `/dashboard/fees/${FEE_ID}`,
    );
    const attemptReads = vi
      .mocked(apiFetch)
      .mock.calls.filter(([input]) => String(input).includes("/attempts/"));
    expect(attemptReads).toHaveLength(0);
  });

  it("shows the not-found copy when the attempt returns 404", async () => {
    mockApi({ status: 404 });
    renderPage();

    expect(
      await screen.findByRole("heading", {
        name: "We couldn't find this payment.",
      }),
    ).toBeInTheDocument();
  });
});

describe("reference", () => {
  it("shows the tran id in a monospace span", async () => {
    mockApi(attempt({ status: "FAILED" }));
    renderPage();

    const reference = await screen.findByText(TRAN);
    expect(reference.tagName).toBe("SPAN");
    expect(reference).toHaveClass("font-mono", "tabular-nums");
  });
});
