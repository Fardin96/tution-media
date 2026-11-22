import { describe, it, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  PhoneVerifier,
  type PhoneVerifierProps,
} from "@/components/profile/phone-verifier";

const NUMBER = "+8801712345678";
const FORMATTED = "+880 1712-345678";

function props(
  overrides: Partial<PhoneVerifierProps> = {},
): PhoneVerifierProps {
  return {
    phoneNumber: NUMBER,
    verifiedAt: null,
    sent: null,
    sending: false,
    verifying: false,
    error: null,
    onSend: vi.fn(),
    onVerify: vi.fn(),
    ...overrides,
  };
}

function sentState(secondsLeft: number) {
  return {
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    resendAfter: new Date(Date.now() + secondsLeft * 1000).toISOString(),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("PhoneVerifier", () => {
  it("idle: shows the number and sends a code", async () => {
    const onSend = vi.fn();
    render(<PhoneVerifier {...props({ onSend })} />);

    expect(
      screen.getByText(`We’ll text a 6-digit code to ${FORMATTED}.`),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Send code" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("idle: disables Send while sending", () => {
    render(<PhoneVerifier {...props({ sending: true })} />);
    const send = screen.getByRole("button", { name: "Send code" });
    expect(send).toBeDisabled();
    expect(send).toHaveAttribute("aria-busy", "true");
  });

  it("idle: shows an error with role alert and links it to the button", () => {
    render(
      <PhoneVerifier {...props({ error: "We couldn't send the SMS." })} />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("We couldn't send the SMS.");
    const button = screen.getByRole("button", { name: "Send code" });
    expect(button.getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("sent: labels the input and sets the code attributes", () => {
    render(<PhoneVerifier {...props({ sent: sentState(60) })} />);

    const input = screen.getByLabelText("Verification code");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).not.toHaveAttribute("maxlength");
    expect(input).toHaveAccessibleDescription(
      `Enter the code we sent to ${FORMATTED}.`,
    );
  });

  it("sent: strips non-digits and verifies once six digits are typed", async () => {
    const onVerify = vi.fn();
    render(<PhoneVerifier {...props({ sent: sentState(60), onVerify })} />);

    const input = screen.getByLabelText("Verification code");
    await userEvent.type(input, "12a34");
    expect(input).toHaveValue("1234");
    expect(onVerify).not.toHaveBeenCalled();

    await userEvent.type(input, "56");
    expect(input).toHaveValue("123456");
    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(onVerify).toHaveBeenCalledWith("123456");
  });

  it("sent: a pasted code is verified", async () => {
    const onVerify = vi.fn();
    render(<PhoneVerifier {...props({ sent: sentState(60), onVerify })} />);

    const input = screen.getByLabelText("Verification code");
    await userEvent.click(input);
    await userEvent.paste("987654");
    expect(onVerify).toHaveBeenCalledWith("987654");
  });

  it("sent: a pasted code with a space keeps its six digits", async () => {
    const onVerify = vi.fn();
    render(<PhoneVerifier {...props({ sent: sentState(60), onVerify })} />);

    const input = screen.getByLabelText("Verification code");
    await userEvent.click(input);
    await userEvent.paste("123 456");
    expect(input).toHaveValue("123456");
    expect(onVerify).toHaveBeenCalledWith("123456");
  });

  it("sent: keeps only the first six digits of a longer paste", async () => {
    const onVerify = vi.fn();
    render(<PhoneVerifier {...props({ sent: sentState(60), onVerify })} />);

    const input = screen.getByLabelText("Verification code");
    await userEvent.click(input);
    await userEvent.paste("1234567890");
    expect(input).toHaveValue("123456");
    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(onVerify).toHaveBeenCalledWith("123456");
  });

  it("sent: does not verify again while a check is running", async () => {
    const onVerify = vi.fn();
    render(
      <PhoneVerifier
        {...props({ sent: sentState(60), verifying: true, onVerify })}
      />,
    );

    await userEvent.type(screen.getByLabelText("Verification code"), "123456");
    expect(onVerify).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Checking the code…");
  });

  it("sent: clears the code when a new error arrives", async () => {
    const { rerender } = render(
      <PhoneVerifier {...props({ sent: sentState(60) })} />,
    );
    const input = screen.getByLabelText("Verification code");
    await userEvent.type(input, "111111");
    expect(input).toHaveValue("111111");

    rerender(
      <PhoneVerifier
        {...props({ sent: sentState(60), error: "That code is wrong." })}
      />,
    );
    expect(input).toHaveValue("");
    expect(screen.getByRole("alert")).toHaveTextContent("That code is wrong.");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(
      screen.getByRole("alert").id,
    );
  });

  it("sent: resend is disabled and counts down until resendAfter", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    const onSend = vi.fn();
    render(
      <PhoneVerifier
        {...props({
          sent: {
            expiresAt: "2026-11-20T10:05:00Z",
            resendAfter: "2026-11-20T10:00:42Z",
          },
          onSend,
        })}
      />,
    );

    const resend = screen.getByRole("button", { name: "Resend code" });
    expect(resend).toBeDisabled();
    // The countdown is visible but hidden from assistive tech, so it is never read every second.
    expect(screen.getByText("Resend in 0:42")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(screen.queryByText("You can request a new code now.")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText("Resend in 0:41")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(41_000);
    });
    expect(screen.queryByText(/Resend in/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled();
  });

  it("sent: announces only when the cooldown ends", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    const { container } = render(
      <PhoneVerifier
        {...props({
          sent: {
            expiresAt: "2026-11-20T10:05:00Z",
            resendAfter: "2026-11-20T10:00:02Z",
          },
        })}
      />,
    );

    const live = container.querySelector('[aria-live="polite"]');
    if (!live) throw new Error("No polite live region");
    expect(live).toHaveTextContent("");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(live).toHaveTextContent("");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(live).toHaveTextContent("You can request a new code now.");
    expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled();
  });

  it("sent: no announcement when the cooldown was already over", () => {
    render(<PhoneVerifier {...props({ sent: sentState(-5) })} />);

    expect(
      screen.queryByText("You can request a new code now."),
    ).not.toBeInTheDocument();
  });

  it("sent: resend sends again once the countdown is over", async () => {
    const onSend = vi.fn();
    render(<PhoneVerifier {...props({ sent: sentState(-5), onSend })} />);

    await userEvent.click(screen.getByRole("button", { name: "Resend code" }));
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("sent: Change number only appears when the callback is given", async () => {
    const onChangeNumber = vi.fn();
    const { rerender } = render(
      <PhoneVerifier {...props({ sent: sentState(60) })} />,
    );
    expect(
      screen.queryByRole("button", { name: "Change number" }),
    ).not.toBeInTheDocument();

    rerender(
      <PhoneVerifier {...props({ sent: sentState(60), onChangeNumber })} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Change number" }),
    );
    expect(onChangeNumber).toHaveBeenCalledTimes(1);
  });

  it("verified: shows the badge and no code input", () => {
    render(
      <PhoneVerifier
        {...props({ verifiedAt: "2026-11-20T10:00:00Z", sent: sentState(60) })}
      />,
    );

    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText(FORMATTED)).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Verification code"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sent: a notice is a hint, not an alert, and is read with the hint", () => {
    render(
      <PhoneVerifier
        {...props({
          sent: sentState(60),
          notice: "We sent a code a moment ago. Enter it below.",
        })}
      />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByLabelText("Verification code"),
    ).toHaveAccessibleDescription(
      `Enter the code we sent to ${FORMATTED}. We sent a code a moment ago. Enter it below.`,
    );
  });

  it("sent: an expired code disables the input and offers a new one", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    render(
      <PhoneVerifier
        {...props({
          sent: {
            expiresAt: "2026-11-20T10:05:00Z",
            resendAfter: "2026-11-20T10:00:30Z",
          },
        })}
      />,
    );
    const input = screen.getByLabelText("Verification code");

    act(() => {
      vi.advanceTimersByTime(4 * 60_000 + 59_000);
    });
    expect(input).toBeEnabled();
    expect(
      screen.queryByText("This code has expired. Send a new one."),
    ).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(input).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "This code has expired. Send a new one.",
    );
    expect(screen.getByRole("button", { name: "Resend code" })).toBeEnabled();
  });

  it("sent: expiry replaces an earlier wrong-code error", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T10:00:00Z"));
    render(
      <PhoneVerifier
        {...props({
          sent: {
            expiresAt: "2026-11-20T10:00:05Z",
            resendAfter: "2026-11-20T10:00:00Z",
          },
          error: "That code is wrong.",
        })}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("That code is wrong.");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "This code has expired. Send a new one.",
    );
  });

  it("sent: keeps the typed code while a check runs", () => {
    const { rerender } = render(
      <PhoneVerifier {...props({ sent: sentState(60) })} />,
    );
    const input = screen.getByLabelText("Verification code");
    fireEvent.change(input, { target: { value: "123" } });
    expect(input).toHaveValue("123");

    rerender(
      <PhoneVerifier {...props({ sent: sentState(60), verifying: true })} />,
    );
    expect(input).toHaveValue("123");
  });

  it("sent: ignores extra submits of the same code while a check is starting", async () => {
    const onVerify = vi.fn();
    render(<PhoneVerifier {...props({ sent: sentState(60), onVerify })} />);

    await userEvent.type(screen.getByLabelText("Verification code"), "1234567");
    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(onVerify).toHaveBeenCalledWith("123456");
  });

  it("sent: clears a rejected code even when the same message repeats", async () => {
    const { rerender } = render(
      <PhoneVerifier
        {...props({ sent: sentState(60), error: "That code is wrong." })}
      />,
    );
    const input = screen.getByLabelText("Verification code");
    await userEvent.type(input, "111111");

    rerender(
      <PhoneVerifier
        {...props({
          sent: sentState(60),
          error: "That code is wrong.",
          verifying: true,
        })}
      />,
    );
    expect(input).toHaveValue("111111");

    rerender(
      <PhoneVerifier
        {...props({ sent: sentState(60), error: "That code is wrong." })}
      />,
    );
    expect(input).toHaveValue("");
  });
});
