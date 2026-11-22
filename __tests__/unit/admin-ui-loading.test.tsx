import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoadMore, QueryState } from "@/components/admin/admin-ui";

const idle = { isPending: false, isError: false, refetch: vi.fn() };

describe("QueryState loading branch", () => {
  it("renders one card per placeholder with Skeleton bars inside", () => {
    render(
      <QueryState
        query={{ ...idle, isPending: true }}
        isEmpty={false}
        loadingLabel="Loading applications"
        errorText="Failed"
        emptyText="Nothing"
        skeletonCount={2}
      >
        <p>content</p>
      </QueryState>,
    );
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading applications");
    expect(screen.queryByText("content")).toBeNull();
    const cards = status.querySelectorAll(':scope > div[aria-hidden="true"]');
    expect(cards).toHaveLength(2);
    cards.forEach((card) => {
      expect(card.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2);
    });
  });

  it("renders children once loaded", () => {
    render(
      <QueryState
        query={idle}
        isEmpty={false}
        loadingLabel="Loading"
        errorText="Failed"
        emptyText="Nothing"
      >
        <p>content</p>
      </QueryState>,
    );
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("LoadMore", () => {
  it("renders nothing without a next page", () => {
    const { container } = render(
      <LoadMore
        query={{
          hasNextPage: false,
          isFetchingNextPage: false,
          fetchNextPage: vi.fn(),
        }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the label and loads the next page when idle", async () => {
    const fetchNextPage = vi.fn();
    render(
      <LoadMore
        query={{
          hasNextPage: true,
          isFetchingNextPage: false,
          fetchNextPage,
        }}
      />,
    );
    const button = screen.getByRole("button", { name: "Load more" });
    expect(button).toBeEnabled();
    expect(button.querySelector(".spinner-ellipsis-dot")).toBeNull();
    await userEvent.click(button);
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it("disables the button and shows the spinner while fetching", () => {
    const { container } = render(
      <LoadMore
        query={{
          hasNextPage: true,
          isFetchingNextPage: true,
          fetchNextPage: vi.fn(),
        }}
      />,
    );
    const button = screen.getByRole("button", { name: "Load more" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelectorAll(".spinner-ellipsis-dot")).toHaveLength(3);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
