import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhoneVerifyDialog } from "@/components/profile/phone-verify-dialog";

vi.mock("@/lib/phone-verification", async (orig) => ({
  ...(await orig<typeof import("@/lib/phone-verification")>()),
  useSendPhoneOtp: () => ({ mutate: vi.fn(), isPending: false }),
  useVerifyPhoneOtp: () => ({ mutate: vi.fn(), isPending: false }),
}));

const NUMBER = "+8801712345678";

function renderDialog(
  props: Partial<React.ComponentProps<typeof PhoneVerifyDialog>> = {},
) {
  return render(
    <PhoneVerifyDialog
      open
      onOpenChange={vi.fn()}
      currentPhone={NUMBER}
      onVerified={vi.fn()}
      {...props}
    />,
  );
}

describe("PhoneVerifyDialog", () => {
  it("offers to send a code to an unverified profile number", () => {
    renderDialog({ currentVerifiedAt: null });
    expect(
      screen.getByRole("button", { name: "Send code" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New mobile number")).toBeNull();
  });

  it("opens on the new-number field when the profile number is verified", () => {
    renderDialog({ currentVerifiedAt: "2026-11-20T10:00:00Z" });
    expect(screen.getByLabelText("New mobile number")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send code" })).toBeNull();
  });

  it("opens on the refused number when a save named one", () => {
    renderDialog({
      currentVerifiedAt: "2026-11-20T10:00:00Z",
      initialNumber: "+8801811111111",
    });
    expect(
      screen.getByRole("button", { name: "Send code" }),
    ).toBeInTheDocument();
  });

  it("checks the new number before sending", () => {
    renderDialog({ currentVerifiedAt: "2026-11-20T10:00:00Z" });
    fireEvent.change(screen.getByLabelText("New mobile number"), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use this number" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a Bangladeshi mobile number",
    );

    fireEvent.change(screen.getByLabelText("New mobile number"), {
      target: { value: "01811111111" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Use this number" }));
    expect(
      screen.getByRole("button", { name: "Send code" }),
    ).toBeInTheDocument();
  });
});
