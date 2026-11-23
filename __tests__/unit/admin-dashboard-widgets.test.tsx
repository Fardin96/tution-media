import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  FunnelWidget,
  flagChange,
} from "@/components/admin/dashboard/funnel-widget";
import { chartKind } from "@/components/admin/dashboard/series-widget";
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
  it("numbers each step in order with its count", () => {
    render(<FunnelWidget payload={flaggedPlacement} />);
    const steps = within(
      screen.getByRole("list", { name: "Placement steps" }),
    ).getAllByRole("listitem");
    expect(steps).toHaveLength(2);
    expect(within(steps[0]).getByText("1.")).toBeInTheDocument();
    expect(within(steps[0]).getByText("Applied")).toBeInTheDocument();
    expect(within(steps[0]).getByText("100")).toBeInTheDocument();
    expect(within(steps[1]).getByText("2.")).toBeInTheDocument();
    expect(within(steps[1]).getByText("Accepted")).toBeInTheDocument();
    expect(within(steps[1]).getByText("40")).toBeInTheDocument();
  });

  it("says where the funnel starts instead of a conversion on the first step", () => {
    render(<FunnelWidget payload={flaggedPlacement} />);
    const [first] = within(
      screen.getByRole("list", { name: "Placement steps" }),
    ).getAllByRole("listitem");
    expect(
      within(first).getByText("Where this funnel starts."),
    ).toBeInTheDocument();
    expect(within(first).queryByText(/moved on/)).not.toBeInTheDocument();
  });

  it("gives the share that moved on, the drop and the median wait for later steps", () => {
    render(<FunnelWidget payload={flaggedPlacement} />);
    const [, accepted] = within(
      screen.getByRole("list", { name: "Placement steps" }),
    ).getAllByRole("listitem");
    // 40 of 100 moved on: 40% of the previous step, 60 dropped off, median 4.2 days.
    expect(accepted.querySelector("dl")?.textContent).toMatch(/40%\s*moved on/);
    expect(within(accepted).getByText("60 dropped")).toBeInTheDocument();
    expect(
      within(accepted).getByText("4.2 days median wait"),
    ).toBeInTheDocument();
  });

  it("rounds the share that moved on to a whole percent", () => {
    const sixtyTwo: FunnelPayload = {
      kind: "funnel",
      funnels: [
        {
          key: "students",
          label: "Students",
          stages: [
            {
              key: "joined",
              label: "Joined",
              count: 100,
              conversion: null,
              medianDays: null,
              flagged: false,
              flagReason: null,
            },
            {
              key: "posted",
              label: "Posted",
              count: 62,
              conversion: 0.62,
              medianDays: null,
              flagged: false,
              flagReason: null,
            },
          ],
        },
      ],
    };
    render(<FunnelWidget payload={sixtyTwo} />);
    const [, posted] = within(
      screen.getByRole("list", { name: "Students steps" }),
    ).getAllByRole("listitem");
    expect(posted.querySelector("dl")?.textContent).toMatch(/62%\s*moved on/);
    expect(within(posted).getByText("38 dropped")).toBeInTheDocument();
    expect(within(posted).queryByText(/median wait/)).not.toBeInTheDocument();
  });

  it("marks a flagged step with a tag and shows its reason inside the funnel", () => {
    render(<FunnelWidget payload={flaggedPlacement} />);
    const list = screen.getByRole("list", { name: "Placement steps" });
    expect(within(list).getByText("Flagged")).toBeInTheDocument();
    expect(
      within(list).getByText("Under 45% of applications"),
    ).toBeInTheDocument();
  });

  it("marks a funnel tab that has a flagged step with a sr-only (flagged)", () => {
    render(<FunnelWidget payload={flaggedPlacement} />);
    expect(
      screen.getByRole("tab", { name: /Placement.*\(flagged\)/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tutors" })).toBeInTheDocument();
  });

  it("switches to the funnel's tab when its chip is clicked and shows that funnel's steps", () => {
    render(<FunnelWidget payload={flaggedTutors} />);
    expect(screen.getByRole("tab", { name: /Placement/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Tutors · Signed up → Verified: Under 20% verified/,
      }),
    );
    expect(screen.getByRole("tab", { name: /Tutors/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const [, verified] = within(
      screen.getByRole("list", { name: "Tutors steps" }),
    ).getAllByRole("listitem");
    // 5 of 50 signed up: 10% moved on, 45 dropped, no median.
    expect(verified.querySelector("dl")?.textContent).toMatch(/10%\s*moved on/);
    expect(within(verified).getByText("45 dropped")).toBeInTheDocument();
    expect(within(verified).queryByText(/median wait/)).not.toBeInTheDocument();
  });

  it("says nothing is flagged when no stage is, with no (flagged) mark on the tab", () => {
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
    expect(screen.getByRole("tab", { name: "Students" })).toBeInTheDocument();
    expect(screen.queryByText("(flagged)")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Flags compare the last 30 days with the 30 before, whatever range is selected.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Recent sign-ups may still move on\./),
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

  it("keeps each step's stats as a valid dl: divs holding only dt and dd", () => {
    render(<FunnelWidget payload={flaggedPlacement} />);
    const dls = Array.from(document.querySelectorAll("dl"));
    expect(dls.length).toBeGreaterThan(0);
    for (const dl of dls) {
      for (const group of Array.from(dl.children)) {
        expect(group.tagName).toBe("DIV");
        for (const child of Array.from(group.children)) {
          expect(["DT", "DD"]).toContain(child.tagName);
        }
      }
    }
    const accepted = dls[0]!;
    expect(accepted.textContent).toMatch(/40%\s*moved on/);
  });

  it("drops the leading percent from a flag reason, and keeps wait reasons as they are", () => {
    expect(flagChange("12%, down 7 pts on the previous 30 days")).toBe(
      "Down 7 pts on the previous 30 days",
    );
    expect(flagChange("Wait 4.2 days, up from 3.1 days")).toBe(
      "Wait 4.2 days, up from 3.1 days",
    );
  });
});

describe("series chart kind", () => {
  const points = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      date: `2026-12-${i + 1}`,
      values: {},
    }));

  it("draws a bar series of 14 points or fewer as bars", () => {
    expect(chartKind({ chart: "bar", points: points(7) })).toBe("bar");
    expect(chartKind({ chart: "bar", points: points(14) })).toBe("bar");
  });

  it("draws a bar series of more than 14 points as a plain area", () => {
    expect(chartKind({ chart: "bar", points: points(30) })).toBe("area");
  });

  it("leaves area and stacked-area series as they are", () => {
    expect(chartKind({ chart: "area", points: points(30) })).toBe("area");
    expect(chartKind({ chart: "stacked-area", points: points(30) })).toBe(
      "stacked-area",
    );
  });
});
