import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FunnelWidget } from "@/components/admin/dashboard/funnel-widget";
import {
  QueueWidget,
  humanAge,
} from "@/components/admin/dashboard/queue-widget";
import type { FunnelPayload, QueuePayload } from "@/lib/admin-dashboard";

const flaggedPlacement: FunnelPayload = {
  kind: "funnel",
  funnels: [
    {
      key: "placement",
      label: "Placement",
      stages: [
        {
          key: "applied",
          label: "Applied",
          count: 100,
          conversion: null,
          medianDays: null,
          flagged: false,
          flagReason: null,
        },
        {
          key: "accepted",
          label: "Accepted",
          count: 40,
          conversion: 0.4,
          medianDays: 4.2,
          flagged: true,
          flagReason: "Under 45% of applications",
        },
      ],
    },
    {
      key: "tutors",
      label: "Tutors",
      stages: [
        {
          key: "signed",
          label: "Signed up",
          count: 50,
          conversion: null,
          medianDays: null,
          flagged: false,
          flagReason: null,
        },
      ],
    },
  ],
};

const flaggedTutors: FunnelPayload = {
  kind: "funnel",
  funnels: [
    {
      key: "placement",
      label: "Placement",
      stages: [
        {
          key: "applied",
          label: "Applied",
          count: 10,
          conversion: null,
          medianDays: null,
          flagged: false,
          flagReason: null,
        },
      ],
    },
    {
      key: "tutors",
      label: "Tutors",
      stages: [
        {
          key: "signed",
          label: "Signed up",
          count: 50,
          conversion: null,
          medianDays: null,
          flagged: false,
          flagReason: null,
        },
        {
          key: "verified",
          label: "Verified",
          count: 5,
          conversion: 0.1,
          medianDays: null,
          flagged: true,
          flagReason: "Under 20% verified",
        },
      ],
    },
  ],
};

describe("FunnelWidget", () => {
  it("lists a flagged stage as a chip with a Flagged tag", () => {
    render(<FunnelWidget payload={flaggedPlacement} />);
    const chip = screen.getByRole("button", {
      name: /Placement · Applied → Accepted: Under 45% of applications/,
    });
    expect(within(chip).getByText("Flagged")).toBeInTheDocument();
  });

  it("switches to the funnel's tab when its chip is clicked", () => {
    render(<FunnelWidget payload={flaggedTutors} />);
    expect(screen.getByRole("tab", { name: "Placement" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Tutors · Signed up → Verified: Under 20% verified/,
      }),
    );
    expect(screen.getByRole("tab", { name: "Tutors" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("shows the stage numbers, conversion and median", () => {
    render(<FunnelWidget payload={flaggedPlacement} />);
    expect(screen.getByText("40% of previous")).toBeInTheDocument();
    expect(screen.getByText("median 4.2 days")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });

  it("says nothing is flagged when no stage is", () => {
    const clean: FunnelPayload = {
      kind: "funnel",
      funnels: [
        {
          key: "students",
          label: "Students",
          stages: [
            {
              key: "joined",
              label: "Joined",
              count: 3,
              conversion: null,
              medianDays: null,
              flagged: false,
              flagReason: null,
            },
          ],
        },
      ],
    };
    render(<FunnelWidget payload={clean} />);
    expect(screen.getByText("Nothing flagged.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Flags compare the last 30 days with the 30 before, whatever range is selected.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Recent sign-ups may still move to the next step."),
    ).toBeInTheDocument();
  });
});

const queue: QueuePayload = {
  kind: "queue",
  rows: [
    {
      key: "payments",
      label: "Payments to check",
      count: 3,
      oldestHours: 30,
      status: "late",
      href: "/dashboard/admin/payments",
    },
    {
      key: "verifications",
      label: "Verifications",
      count: 2,
      oldestHours: 3,
      status: "watch",
      href: "/dashboard/admin/verifications",
    },
    {
      key: "refunds",
      label: "Refunds",
      count: 0,
      oldestHours: null,
      status: "ok",
      href: "/dashboard/admin/refunds",
    },
  ],
};

describe("QueueWidget", () => {
  it("renders each busy row as a link with its status chip", () => {
    render(<QueueWidget payload={queue} />);
    const late = screen.getByRole("link", { name: /Payments to check/ });
    expect(late).toHaveAttribute("href", "/dashboard/admin/payments");
    expect(within(late).getByText("Late")).toBeInTheDocument();
    expect(within(late).getByText("oldest 1 d")).toBeInTheDocument();
    const watch = screen.getByRole("link", { name: /Verifications/ });
    expect(within(watch).getByText("Watch")).toBeInTheDocument();
  });

  it("collapses empty queues into one All clear line", () => {
    render(<QueueWidget payload={queue} />);
    expect(screen.getByText("All clear: Refunds")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Refunds/ }),
    ).not.toBeInTheDocument();
  });

  it("humanises ages", () => {
    expect(humanAge(0.5)).toBe("under 1 h");
    expect(humanAge(3)).toBe("3 h");
    expect(humanAge(49)).toBe("2 d");
    expect(humanAge(null)).toBe("—");
  });
});
