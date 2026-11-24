import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ProfileStrengthCard } from "@/components/profile/profile-strength-card";
import { drawAttention } from "@/lib/attention";

vi.mock("@/lib/attention", () => ({ drawAttention: vi.fn(() => true) }));
import type { Schemas } from "@/lib/api-client";

type Strength = Schemas["ProfileStrength"];
type Key = Strength["items"][number]["key"];

const TUTOR_WEIGHTS: Partial<Record<Key, number>> = {
  basics: 10,
  phone_verified: 15,
  photo: 10,
  institute: 10,
  subjects: 10,
  location_pin: 10,
  default_set: 10,
  id_verified: 15,
  credential: 5,
  video: 5,
};

const STUDENT_WEIGHTS: Partial<Record<Key, number>> = {
  basics: 15,
  phone_verified: 25,
  photo: 15,
  location_pin: 15,
  id_verified: 20,
  whatsapp: 10,
};

/** The API's rules: percent is the done weight, complete at 60, badge at 85 (tutor) or 80 (student). */
function strength(
  weights: Partial<Record<Key, number>>,
  done: Key[],
  badgeAt = 85,
): Strength {
  const items = Object.entries(weights).map(([key, weight]) => ({
    key: key as Key,
    weight: weight ?? 0,
    done: done.includes(key as Key),
  }));
  const percent = items
    .filter((i) => i.done)
    .reduce((sum, i) => sum + i.weight, 0);
  return {
    percent,
    complete: percent >= 60,
    completeAt: 60,
    verifiedBadge:
      percent >= badgeAt &&
      done.includes("id_verified") &&
      done.includes("phone_verified"),
    badgeAt,
    items,
  };
}

const TUTOR_PARTIAL = strength(TUTOR_WEIGHTS, [
  "basics",
  "photo",
  "institute",
  "subjects",
  "credential",
]);

function renderCard(props: {
  role?: "TUTOR" | "STUDENT";
  strength?: Strength;
  applyReadiness?: { ready: boolean };
  onVerifyPhone?: () => void;
  /** Most tests read the details, so the card opens unless told not to. */
  expanded?: boolean;
}) {
  const result = render(
    <ProfileStrengthCard
      role={props.role ?? "TUTOR"}
      strength={props.strength}
      applyReadiness={props.applyReadiness}
      onVerifyPhone={props.onVerifyPhone ?? vi.fn()}
    />,
  );
  const more = screen.queryByRole("button", { name: "View more" });
  if (more && props.expanded !== false) fireEvent.click(more);
  return result;
}

describe("ProfileStrengthCard", () => {
  it("renders nothing when the account has no profile strength", () => {
    const { container } = renderCard({});

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the percent and how far it is to complete", () => {
    renderCard({ strength: TUTOR_PARTIAL });

    const section = screen.getByRole("region", { name: "Profile strength" });
    expect(within(section).getAllByText("45%")[0]).toBeInTheDocument();
    expect(
      screen.getByText("Add 15% more to complete your profile."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Profile strength" }),
    ).toHaveAttribute("aria-valuenow", "45");
  });

  it("describes the progress bar's markers in aria-valuetext", () => {
    renderCard({ strength: TUTOR_PARTIAL });

    expect(
      screen.getByRole("progressbar", { name: "Profile strength" }),
    ).toHaveAttribute(
      "aria-valuetext",
      "45%, complete at 60%, verified badge at 85%",
    );
  });

  it("adds that the tutor can already apply once the apply gate passes", () => {
    renderCard({
      strength: TUTOR_PARTIAL,
      applyReadiness: { ready: true },
    });

    expect(
      screen.getByText(
        "Add 15% more to complete your profile. You can already apply.",
      ),
    ).toBeInTheDocument();
  });

  it("asks for the verified badge once the profile is complete", () => {
    renderCard({
      strength: strength(TUTOR_WEIGHTS, [
        "basics",
        "photo",
        "institute",
        "subjects",
        "location_pin",
        "default_set",
      ]),
    });

    expect(
      screen.getByText(
        "Your profile is complete. Reach 85% with your phone and ID verified to get the verified badge.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: "Verified" }),
    ).not.toBeInTheDocument();
  });

  it("points to the apply checklist when the profile is complete but not ready to apply", () => {
    renderCard({
      strength: strength(TUTOR_WEIGHTS, [
        "basics",
        "photo",
        "institute",
        "subjects",
        "location_pin",
        "default_set",
      ]),
      applyReadiness: { ready: false },
    });

    expect(
      screen.getByText(
        "Your profile is complete. Reach 85% with your phone and ID verified to get the verified badge. Finish the apply checklist before you can apply.",
      ),
    ).toBeInTheDocument();
  });

  it("says the badge is held once the profile is verified, with a decorative badge", () => {
    renderCard({
      strength: strength(TUTOR_WEIGHTS, [
        "basics",
        "phone_verified",
        "photo",
        "institute",
        "subjects",
        "location_pin",
        "default_set",
        "id_verified",
      ]),
    });

    expect(
      screen.getByText("You have the verified badge."),
    ).toBeInTheDocument();
    const icon = screen
      .getByText("You have the verified badge.")
      .querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(
      screen.queryByRole("img", { name: "Verified" }),
    ).not.toBeInTheDocument();
  });

  it("collapses to one compact row at 100% with the badge", () => {
    const all = Object.keys(TUTOR_WEIGHTS) as Key[];
    renderCard({ strength: strength(TUTOR_WEIGHTS, all) });

    expect(
      screen.getByText("Profile 100% complete. You have the verified badge."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("progressbar", { name: "Profile strength" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Done \(/)).not.toBeInTheDocument();
  });

  it("lists the items not done with their weight and where to fix them", () => {
    const onVerifyPhone = vi.fn();
    renderCard({ strength: TUTOR_PARTIAL, onVerifyPhone });

    const pin = screen.getByRole("button", {
      name: /Pin your location on the map/,
    });
    expect(within(pin).getByText("+10%")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Set up a default requirement set/ }),
    ).toHaveAttribute("href", "/dashboard/tutor/requirements");

    const phone = screen.getByRole("button", {
      name: /Verify your phone number/,
    });
    expect(within(phone).getByText("+15%")).toBeInTheDocument();
    fireEvent.click(phone);
    expect(onVerifyPhone).toHaveBeenCalledOnce();
  });

  it.each([
    [/Pin your location on the map/, "profile"],
    [/Get your ID verified/, "verification"],
    [/Add a teaching video/, "videos"],
    [/Add a certificate/, "credentials"],
  ])("%s closes the panel and points at #%s", (name, id) => {
    vi.mocked(drawAttention).mockClear();
    renderCard({ strength: strength(TUTOR_WEIGHTS, ["basics"]) });

    fireEvent.click(screen.getByRole("button", { name }));
    expect(drawAttention).toHaveBeenCalledWith(id);
    expect(screen.getByRole("button", { name: "View more" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("shows only the bar until View more is pressed, then Show less hides the rest", () => {
    renderCard({ strength: TUTOR_PARTIAL, expanded: false });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText(/Verify your phone number/)).toBeNull();
    expect(screen.queryByText(/Done \(/)).toBeNull();

    const toggle = screen.getByRole("button", { name: "View more" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("Show less");
    expect(
      screen.getByRole("button", { name: /Verify your phone number/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Add a teaching video/ }),
    ).toBeInTheDocument();
  });

  it("collapses the done items under a count", () => {
    renderCard({ strength: TUTOR_PARTIAL });

    const summary = screen.getByText("Done (5)");
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent("Name and address");
    expect(details).toHaveTextContent("Certificate");
  });

  it("uses the student's items and targets", () => {
    renderCard({
      role: "STUDENT",
      strength: strength(STUDENT_WEIGHTS, ["basics"], 80),
    });

    vi.mocked(drawAttention).mockClear();
    fireEvent.click(
      screen.getByRole("button", { name: /Get your student ID verified/ }),
    );
    expect(drawAttention).toHaveBeenCalledWith("verification");
    fireEvent.click(screen.getByRole("button", { name: "View more" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Add a WhatsApp number/ }),
    );
    expect(drawAttention).toHaveBeenLastCalledWith("profile");
  });

  it("hides the marker labels from screen readers", () => {
    renderCard({ strength: TUTOR_PARTIAL });

    expect(
      screen.getByText("Complete").closest("[aria-hidden]"),
    ).toHaveAttribute("aria-hidden", "true");
  });

  it("moves the marker labels outside their markers when they are close", () => {
    renderCard({
      role: "STUDENT",
      strength: strength(STUDENT_WEIGHTS, ["basics"], 80),
    });

    expect(screen.getByText("Complete")).toHaveClass("-translate-x-full");
    expect(screen.getByText("Verified")).not.toHaveClass("-translate-x-1/2");
  });

  it("centres the marker labels when the markers are far apart", () => {
    renderCard({ strength: TUTOR_PARTIAL });

    expect(screen.getByText("Complete")).toHaveClass("-translate-x-1/2");
    expect(screen.getByText("Verified")).toHaveClass("-translate-x-1/2");
  });
});
