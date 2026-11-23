import { describe, it, expect } from "vitest";
import { render as rtlRender, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import {
  TutorResultCard,
  type TutorResult,
} from "@/components/browse/tutor-result-card";

const tutor: TutorResult = {
  id: "t-1",
  name: "Nusrat Jahan",
  avatarUrl: null,
  instituteName: "University of Dhaka",
  ratingAvg: 4.5,
  ratingCount: 12,
  areas: [
    { id: 1, name: "Dhanmondi" },
    { id: 2, name: "Banani" },
  ],
  subjects: [
    { id: 5, name: "Physics" },
    { id: 7, name: "Chemistry" },
  ],
};

function renderCard(card: TutorResult) {
  return render(
    <ul>
      <TutorResultCard tutor={card} />
    </ul>,
  );
}

/** The paragraph that holds the location text (areas and distance). */
function locationLine() {
  return screen.getByText("Dhanmondi, Banani", { exact: false }).closest("p");
}

function follows(first: Node, second: Node) {
  return !!(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING
  );
}

/** Avatars refresh expired photo links through the query client, so each render gets one. */
function render(ui: ReactElement) {
  const client = new QueryClient();
  return rtlRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

describe("TutorResultCard", () => {
  it("orders the name, institute, location and subjects", () => {
    renderCard(tutor);

    const name = screen.getByRole("heading", { name: "Nusrat Jahan" });
    const institute = screen.getByText("University of Dhaka");
    const location = locationLine()!;
    const subjects = screen.getByRole("list", { name: "Subjects" });

    expect(follows(name, institute)).toBe(true);
    expect(follows(institute, location)).toBe(true);
    expect(follows(location, subjects)).toBe(true);
  });

  it("puts the rating on the same row as the name", () => {
    renderCard(tutor);

    const name = screen.getByRole("heading", { name: "Nusrat Jahan" });
    expect(name.parentElement).toContainElement(screen.getByText("4.5"));
  });

  it("shows the institute with a decorative icon", () => {
    renderCard(tutor);

    const institute = screen.getByText("University of Dhaka").closest("p")!;
    expect(institute.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("shows areas as one location line, not as chips", () => {
    renderCard(tutor);

    expect(locationLine()).toHaveTextContent("Dhanmondi, Banani");
    expect(locationLine()).not.toHaveTextContent("away");
    const subjects = screen.getByRole("list", { name: "Subjects" });
    expect(within(subjects).queryByText("Dhanmondi")).not.toBeInTheDocument();
    expect(within(subjects).queryByText("Banani")).not.toBeInTheDocument();
  });

  it("adds the distance to the location line in the nearby list", () => {
    renderCard({ ...tutor, distanceMeters: 2500 });

    expect(locationLine()).toHaveTextContent("Dhanmondi, Banani · 2.5 km away");
    expect(screen.getByText("2.5 km")).toHaveClass("tabular-nums");
  });

  it("shows only the distance when the tutor has no areas", () => {
    renderCard({ ...tutor, areas: [], distanceMeters: 400 });

    const line = screen.getByText("Under 1 km", { exact: false }).closest("p");
    expect(line).toHaveTextContent("Under 1 km away");
    expect(line).not.toHaveTextContent("·");
  });

  it("lists subjects as chips in order", () => {
    renderCard(tutor);

    const subjects = screen.getByRole("list", { name: "Subjects" });
    expect(
      within(subjects)
        .getAllByRole("listitem")
        .map((chip) => chip.textContent),
    ).toEqual(["Physics", "Chemistry"]);
  });

  it("links the name to the tutor's profile page", () => {
    renderCard(tutor);

    expect(screen.getByRole("link", { name: "Nusrat Jahan" })).toHaveAttribute(
      "href",
      "/tutors/t-1",
    );
  });

  it("omits the lines that have no data", () => {
    renderCard({
      id: "t-2",
      name: "Rafi Ahmed",
      avatarUrl: null,
      instituteName: null,
      ratingAvg: 0,
      ratingCount: 0,
      areas: [],
      subjects: [],
    });

    expect(
      screen.getByRole("heading", { name: "Rafi Ahmed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Subjects" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/away/)).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).not.toHaveTextContent("University");
  });
});
