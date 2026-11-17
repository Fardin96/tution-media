import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PackageCard,
  studentPlaceText,
} from "@/components/browse/package-card";
import { apiFetch } from "@/lib/api";
import type { TuitionPackage } from "@/lib/browse";
import { formatTimeRange } from "@/lib/tutor-requirements";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const LOOKUP = {
  version: 1,
  levelRange: { min: 0, max: 13 },
  groupLevels: { min: 9, max: 12 },
  admissionLevel: 13,
  levelNoteMaxLength: 40,
  curricula: [
    {
      code: "BANGLA_MEDIUM",
      label: "Bangla medium",
      levels: [
        { code: 9, label: "Class 9" },
        { code: 12, label: "Class 12" },
      ],
      groups: [],
    },
  ],
  admissionTargets: [],
  retakerLabels: [],
};

function pkg(overrides: Partial<TuitionPackage> = {}): TuitionPackage {
  return {
    id: "pkg-1",
    tutor: {
      id: "tutor-1",
      name: "Nusrat Jahan",
      gender: "FEMALE",
      ratingAvg: 4.5,
      ratingCount: 12,
    },
    title: "SSC Physics crash course",
    description: "Covers the full HSC physics syllabus.",
    coverage: "PARTIAL",
    durationWeeks: 12,
    price: 15000,
    subjectIds: [5],
    levelMin: 9,
    levelMax: 12,
    curricula: ["BANGLA_MEDIUM"],
    academicGroups: [],
    admissionTargets: [],
    timeFrom: "16:00",
    timeTo: "18:00",
    availableDays: 5,
    daysPerWeek: 3,
    maxStudents: 2,
    availableFrom: "2026-12-01",
    teachesOnline: false,
    zoneCount: 2,
    status: "OPEN",
    moderationStatus: "APPROVED",
    createdAt: "2026-11-01T00:00:00.000Z",
    closed: false,
    myApplication: null,
    ...overrides,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function renderCard(card: TuitionPackage) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ul>
        <PackageCard pkg={card} />
      </ul>
    </QueryClientProvider>,
  );
}

/** The value under a label in the card's definition list. */
function valueOf(container: HTMLElement, label: string) {
  return within(container).getByText(label, { selector: "dt" })
    .nextElementSibling;
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockImplementation(async (input: string) => {
    const { pathname } = new URL(String(input), "http://localhost");
    if (pathname === "/api/v1/lookups/education") return json(LOOKUP);
    return json({ error: "unexpected" }, 500);
  });
});

describe("PackageCard", () => {
  it("shows the package title as the heading and the subjects and level beneath it", async () => {
    renderCard(pkg());

    expect(
      screen.getByRole("heading", {
        level: 3,
        name: "SSC Physics crash course",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Physics · Class 9 to Class 12"),
    ).toBeInTheDocument();
  });

  it("shows the whole-package price as total with the duration beside it", async () => {
    renderCard(pkg());
    const card = screen.getByRole("listitem");

    expect(valueOf(card, "Price")).toHaveTextContent(/^৳15,000 total$/);
    expect(valueOf(card, "Duration")).toHaveTextContent(/^12 weeks$/);
    expect(card).not.toHaveTextContent("a month");
    expect(card).not.toHaveTextContent("/ month");
  });

  it("shows the days and time range as the schedule", async () => {
    renderCard(pkg());
    const card = screen.getByRole("listitem");

    expect(valueOf(card, "Schedule")).toHaveTextContent(
      `3 days a week · Sat, Mon · ${formatTimeRange("16:00", "18:00")}`,
    );
  });

  it("never shows zone counts to a student", async () => {
    renderCard(pkg({ zoneCount: 3, teachesOnline: true }));
    const card = screen.getByRole("listitem");

    expect(card).not.toHaveTextContent(/zone/i);
    expect(valueOf(card, "Place")).toHaveTextContent("Online or in person");
  });

  it("links an open package to its detail page", async () => {
    renderCard(pkg({ id: "pkg-open" }));

    expect(screen.getByRole("link", { name: /View package/ })).toHaveAttribute(
      "href",
      "/dashboard/find-tutors/packages/pkg-open",
    );
  });
});

describe("studentPlaceText", () => {
  it("says online, in person, or both, without counting zones", () => {
    expect(studentPlaceText({ teachesOnline: true, zoneCount: 0 })).toBe(
      "Online",
    );
    expect(studentPlaceText({ teachesOnline: false, zoneCount: 2 })).toBe(
      "In person",
    );
    expect(studentPlaceText({ teachesOnline: true, zoneCount: 1 })).toBe(
      "Online or in person",
    );
  });

  it("falls back to to be agreed when the package names no place", () => {
    expect(studentPlaceText({ teachesOnline: false, zoneCount: 0 })).toBe(
      "To be agreed",
    );
  });
});
