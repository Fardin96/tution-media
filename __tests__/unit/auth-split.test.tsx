import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthSplit } from "@/components/auth/auth-split";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("@/components/mesh-gradient/mesh-gradient-animated", () => ({
  AnimatedMeshGradientLayer: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

describe("AuthSplit", () => {
  it("keeps next on the sign-up switch link", () => {
    render(
      <AuthSplit
        mode="sign-in"
        clientId="id"
        next="/tutors/abc?sort=emerging"
      />,
    );
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      `/sign-up?next=${encodeURIComponent("/tutors/abc?sort=emerging")}`,
    );
  });

  it("keeps next on the sign-in switch link", () => {
    render(
      <AuthSplit
        mode="sign-up"
        clientId="id"
        role="STUDENT"
        next="/tutors/abc"
      />,
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in?next=%2Ftutors%2Fabc",
    );
  });

  it("starts sign-up with the default role picked", () => {
    render(<AuthSplit mode="sign-up" clientId="id" defaultRole="STUDENT" />);
    expect(screen.queryByText("Pick a role above to continue.")).toBeNull();
    expect(screen.getByRole("button", { name: /Student/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("asks for a role on sign-up without a default", () => {
    render(<AuthSplit mode="sign-up" clientId="id" />);
    expect(
      screen.getByText("Pick a role above to continue."),
    ).toBeInTheDocument();
  });

  it("leaves the switch links plain without next", () => {
    render(<AuthSplit mode="sign-in" clientId="id" />);
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute(
      "href",
      "/sign-up",
    );
  });
});
