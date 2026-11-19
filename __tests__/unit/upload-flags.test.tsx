import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UploadFlagsNote } from "@/components/admin/upload-flags";

describe("UploadFlagsNote", () => {
  it("renders nothing for an account with no issues and no pause", () => {
    const { container } = render(
      <UploadFlagsNote
        uploadFlags={{ recentIssues: 0, uploadsBlocked: false }}
        accountId="acc-1"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the issue count and a link to upload history", () => {
    render(
      <UploadFlagsNote
        uploadFlags={{ recentIssues: 2, uploadsBlocked: false }}
        accountId="acc-1"
      />,
    );
    expect(screen.getByText("2 issues in 30 days")).toBeInTheDocument();
    expect(screen.queryByText("Repeated issues")).not.toBeInTheDocument();
    expect(screen.queryByText("Uploads paused")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Upload history" }),
    ).toHaveAttribute("href", "/dashboard/admin/accounts/acc-1#uploads");
  });

  it("adds the repeated-issues warning at three issues", () => {
    render(
      <UploadFlagsNote
        uploadFlags={{ recentIssues: 3, uploadsBlocked: false }}
        accountId="acc-1"
      />,
    );
    expect(screen.getByText("Repeated issues")).toBeInTheDocument();
  });

  it("shows the paused pill when uploads are blocked", () => {
    render(
      <UploadFlagsNote
        uploadFlags={{ recentIssues: 0, uploadsBlocked: true }}
        accountId="acc-1"
      />,
    );
    expect(screen.getByText("Uploads paused")).toBeInTheDocument();
    expect(screen.queryByText(/issues? in 30 days/)).not.toBeInTheDocument();
  });
});
