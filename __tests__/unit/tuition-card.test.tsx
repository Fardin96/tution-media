import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  TuitionCard,
  type TuitionApplyState,
} from "@/components/browse/tuition-card";
import type { BrowseRequirement } from "@/lib/browse";

const NOW = "2026-11-10T06:00:00.000Z";

const BASE: BrowseRequirement = {
  id: "req-1",
  areaId: 1,
  subjectIds: [3],
  curriculum: "BANGLA_MEDIUM",
  levelCode: 9,
  academicGroup: null,
  admissionTargets: [],
  isRetaker: false,
  levelNote: null,
  timeOfDay: "18:00",
  daysPerWeek: 3,
  availableDays: 127,
  salary: 25000,
  studentCount: 1,
  hireByDate: null,
  tutorGenderPref: "ANY",
  tuitionType: null,
  createdAt: NOW,
  distanceKm: null,
  closed: false,
  myApplication: null,
  invitedAt: null,
  match: null,
};

const OPEN: TuitionApplyState = {
  kind: "open",
  applying: false,
  blockedReason: null,
  onApply: vi.fn(),
};

function renderCard(
  tuition: BrowseRequirement,
  apply: TuitionApplyState = OPEN,
) {
  // The card reads the query client for intent prefetch, as it does inside the app providers.
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <TuitionCard
        tuition={tuition}
        subjectNames={["Physics"]}
        curriculumLabel="Bangla medium"
        levelLabel="Class 9"
        areaName="Dhanmondi"
        apply={apply}
      />
    </QueryClientProvider>,
  );
}

describe("TuitionCard match reasons", () => {
  it("shows met and unmet reasons as chips with their text", () => {
    renderCard({
      ...BASE,
      match: {
        score: 87,
        reasons: [
          { rule: "curriculum", ok: true, label: "Teaches the curriculum" },
          { rule: "salary", ok: false, label: "Salary below the offer" },
        ],
      },
    });

    const list = screen.getByRole("list", { name: "Match reasons" });
    const chips = within(list).getAllByRole("listitem");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveTextContent("Met: Teaches the curriculum");
    expect(chips[1]).toHaveTextContent("Not met: Salary below the offer");
  });

  it("never shows the numeric score", () => {
    renderCard({
      ...BASE,
      match: {
        score: 87,
        reasons: [
          { rule: "curriculum", ok: true, label: "Teaches the curriculum" },
        ],
      },
    });

    expect(screen.queryByText("87")).not.toBeInTheDocument();
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });

  it("shows no chip row when the tuition has no match", () => {
    renderCard(BASE);

    expect(
      screen.queryByRole("list", { name: "Match reasons" }),
    ).not.toBeInTheDocument();
  });
});

describe("TuitionCard invited pill", () => {
  it("shows Invited when the student invited this tutor", () => {
    renderCard({ ...BASE, invitedAt: NOW });

    expect(screen.getByText("Invited")).toBeInTheDocument();
  });

  it("does not show Invited without an invite", () => {
    renderCard(BASE);

    expect(screen.queryByText("Invited")).not.toBeInTheDocument();
  });

  it("keeps the Apply button next to the Invited pill", () => {
    renderCard({ ...BASE, invitedAt: NOW });

    expect(screen.getByRole("button", { name: /^Apply/ })).toBeEnabled();
  });
});
