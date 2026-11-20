import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { PhoneVerificationPanel } from "@/components/profile/phone-verification-panel";
import { errorCodeMessage } from "@/lib/api-errors";
import { ApiError } from "@/lib/profile";

const { sendMock, verifyMock } = vi.hoisted(() => ({
  sendMock: { mutate: vi.fn(), isPending: false },
  verifyMock: { mutate: vi.fn(), isPending: false },
}));

vi.mock("@/lib/phone-verification", () => ({
  useSendPhoneOtp: () => sendMock,
  useVerifyPhoneOtp: () => verifyMock,
}));

const NUMBER = "+8801712345678";
const NOW = "2026-11-20T10:00:00Z";
const COOLDOWN_NOTICE = "We sent a code a moment ago. Enter it below.";
const EXPIRED = "This code has expired. Send a new one.";

type Callbacks = {
  onSuccess?: (data: unknown) => void;
  onError?: (err: unknown) => void;
};

function apiError(
  code: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return new ApiError("Server message", status, { code, details });
}

/** Makes the next send settle with a success or an error. */
function replySend(reply: unknown) {
  sendMock.mutate.mockImplementation((_phone: string, cb: Callbacks) => {
    if (reply instanceof ApiError) cb.onError?.(reply);
    else cb.onSuccess?.(reply);
  });
}

/** Makes the next verify settle with a success or an error. */
function replyVerify(reply: unknown) {
  verifyMock.mutate.mockImplementation((_vars: unknown, cb: Callbacks) => {
    if (reply instanceof ApiError) cb.onError?.(reply);
    else cb.onSuccess?.(reply);
  });
}

function sendCode() {
  fireEvent.click(screen.getByRole("button", { name: "Send code" }));
}

function typeCode(code: string) {
  fireEvent.change(screen.getByLabelText("Verification code"), {
    target: { value: code },
  });
}

function resendButton() {
  return screen.getByRole("button", { name: "Resend code" });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(NOW));
  sendMock.mutate.mockReset();
  verifyMock.mutate.mockReset();
  sendMock.isPending = false;
  verifyMock.isPending = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PhoneVerificationPanel", () => {
  it("sends a code and moves to the enter-code step", () => {
    replySend({
      expiresAt: "2026-11-20T10:05:00.000Z",
      resendAfter: "2026-11-20T10:01:00.000Z",
    });
    render(<PhoneVerificationPanel phoneNumber={NUMBER} verifiedAt={null} />);

    sendCode();

    expect(sendMock.mutate).toHaveBeenCalledWith(NUMBER, expect.any(Object));
    expect(screen.getByLabelText("Verification code")).toBeEnabled();
    expect(resendButton()).toBeDisabled();
  });

  it("shows a send error as an alert and stays on the send step", () => {
    replySend(apiError("SMS_UNAVAILABLE", 503));
    render(<PhoneVerificationPanel phoneNumber={NUMBER} verifiedAt={null} />);

    sendCode();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      errorCodeMessage(apiError("SMS_UNAVAILABLE", 503)) ?? "",
    );
    expect(screen.queryByLabelText("Verification code")).toBeNull();
  });

  it("a cooldown reply opens the enter-code step with a hint, not an error", () => {
    replySend(apiError("OTP_COOLDOWN", 429, { retryAfterSeconds: 42 }));
    render(<PhoneVerificationPanel phoneNumber={NUMBER} verifiedAt={null} />);

    sendCode();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Verification code")).toBeEnabled();
    expect(screen.getByText(COOLDOWN_NOTICE)).toBeInTheDocument();
    expect(resendButton()).toBeDisabled();
    expect(screen.getByText("Resend in 0:42")).toBeInTheDocument();

    advance(42_000);
    expect(resendButton()).toBeEnabled();
  });

  it("a cooldown reply keeps the earlier code usable for about four more minutes", () => {
    replySend(apiError("OTP_COOLDOWN", 429, { retryAfterSeconds: 42 }));
    render(<PhoneVerificationPanel phoneNumber={NUMBER} verifiedAt={null} />);

    sendCode();
    advance(42_000 + 4 * 60_000 - 1000);
    expect(screen.queryByText(EXPIRED)).not.toBeInTheDocument();

    advance(1000);
    expect(screen.getByRole("status")).toHaveTextContent(EXPIRED);
    expect(screen.getByLabelText("Verification code")).toBeDisabled();
  });

  it("a cooldown reply without a retry time waits the default minute", () => {
    replySend(apiError("OTP_COOLDOWN", 429));
    render(<PhoneVerificationPanel phoneNumber={NUMBER} verifiedAt={null} />);

    sendCode();

    expect(screen.getByText("Resend in 1:00")).toBeInTheDocument();
  });

  it("an expired code shows the expired state and resend waits for the cooldown", () => {
    replySend({
      expiresAt: "2026-11-20T10:05:00.000Z",
      resendAfter: "2026-11-20T10:01:00.000Z",
    });
    replyVerify(apiError("OTP_EXPIRED", 400));
    render(<PhoneVerificationPanel phoneNumber={NUMBER} verifiedAt={null} />);
    sendCode();

    typeCode("123456");

    expect(screen.getByRole("status")).toHaveTextContent(EXPIRED);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Verification code")).toBeDisabled();
    expect(resendButton()).toBeDisabled();

    advance(60_000);
    expect(resendButton()).toBeEnabled();
  });

  it("too many attempts treats the code as dead like an expired one", () => {
    replySend({
      expiresAt: "2026-11-20T10:05:00.000Z",
      resendAfter: "2026-11-20T10:00:00.000Z",
    });
    replyVerify(apiError("OTP_TOO_MANY_ATTEMPTS", 429));
    render(<PhoneVerificationPanel phoneNumber={NUMBER} verifiedAt={null} />);
    sendCode();

    typeCode("123456");

    expect(screen.getByRole("status")).toHaveTextContent(EXPIRED);
    expect(screen.getByLabelText("Verification code")).toBeDisabled();
    expect(resendButton()).toBeEnabled();
  });

  it("a wrong code shows its message, clears the code, and keeps the input open", () => {
    const wrong = apiError("OTP_INVALID", 400, { attemptsLeft: 3 });
    replySend({
      expiresAt: "2026-11-20T10:05:00.000Z",
      resendAfter: "2026-11-20T10:01:00.000Z",
    });
    replyVerify(wrong);
    render(<PhoneVerificationPanel phoneNumber={NUMBER} verifiedAt={null} />);
    sendCode();

    typeCode("123456");

    expect(screen.getByRole("alert")).toHaveTextContent(
      errorCodeMessage(wrong) ?? "",
    );
    expect(screen.queryByText(EXPIRED)).toBeNull();
    const input = screen.getByLabelText("Verification code");
    expect(input).toHaveValue("");
    expect(input).toBeEnabled();
  });

  it("a correct code reports the verified number and shows the badge", () => {
    const onVerified = vi.fn();
    replySend({
      expiresAt: "2026-11-20T10:05:00.000Z",
      resendAfter: "2026-11-20T10:01:00.000Z",
    });
    replyVerify({ phoneNumber: NUMBER, verifiedAt: NOW });
    render(
      <PhoneVerificationPanel
        phoneNumber={NUMBER}
        verifiedAt={null}
        onVerified={onVerified}
      />,
    );
    sendCode();

    typeCode("123456");

    expect(verifyMock.mutate).toHaveBeenCalledWith(
      { phoneNumber: NUMBER, code: "123456" },
      expect.any(Object),
    );
    expect(onVerified).toHaveBeenCalledWith({
      phoneNumber: NUMBER,
      verifiedAt: NOW,
    });
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("does not send a second verify while one is running", () => {
    replySend({
      expiresAt: "2026-11-20T10:05:00.000Z",
      resendAfter: "2026-11-20T10:01:00.000Z",
    });
    verifyMock.isPending = true;
    render(<PhoneVerificationPanel phoneNumber={NUMBER} verifiedAt={null} />);
    sendCode();

    typeCode("123456");

    expect(verifyMock.mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Checking the code…")).toBeInTheDocument();
  });
});
