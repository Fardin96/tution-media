import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SitePageView } from "@/components/site-page";
import { formatPostDate } from "@/lib/blog";
import type { SitePage } from "@/lib/site-content";

const page: SitePage = {
  slug: "terms",
  title: "Terms and Conditions",
  description: "The rules for using Masters Hub.",
  body: "These terms apply to everyone.\n\n## Accounts\n\nKeep your sign-in secure.",
  updatedAt: null,
};

describe("SitePageView", () => {
  it("renders the title as the only h1 with the description", () => {
    render(<SitePageView page={page} />);
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Terms and Conditions");
    expect(
      screen.getByText("The rules for using Masters Hub."),
    ).toBeInTheDocument();
  });

  it("renders markdown headings from the body as h2", () => {
    render(<SitePageView page={page} />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Accounts" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Keep your sign-in secure.")).toBeInTheDocument();
  });

  it("hides the last updated line when updatedAt is null", () => {
    render(<SitePageView page={page} />);
    expect(screen.queryByText(/Last updated/)).not.toBeInTheDocument();
  });

  it("shows the formatted last updated date when set", () => {
    const updatedAt = "2026-11-01T06:00:00Z";
    render(<SitePageView page={{ ...page, updatedAt }} />);
    expect(screen.getByText(/Last updated/)).toHaveTextContent(
      `Last updated ${formatPostDate(updatedAt)}`,
    );
  });

  it("renders children between the description and the body", () => {
    render(
      <SitePageView page={page}>
        <p>Support details here</p>
      </SitePageView>,
    );
    expect(screen.getByText("Support details here")).toBeInTheDocument();
  });
});
