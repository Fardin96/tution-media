import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PhoneVerifyHost } from "@/components/profile/phone-verify-host";
import { requestPhoneVerify } from "@/lib/phone-verify-request";

vi.mock("@/components/profile/phone-verify-in-place", () => ({
  PhoneVerifyInPlace: ({ open }: { open: boolean }) => (
    <div data-testid="verify-in-place" data-open={String(open)} />
  ),
}));

describe("PhoneVerifyHost", () => {
  it("renders nothing until a request is made", () => {
    render(<PhoneVerifyHost />);
    expect(screen.queryByTestId("verify-in-place")).toBeNull();
  });

  it("opens the dialog on a request", () => {
    render(<PhoneVerifyHost />);
    act(() => requestPhoneVerify());
    expect(screen.getByTestId("verify-in-place")).toHaveAttribute(
      "data-open",
      "true",
    );
  });
});
