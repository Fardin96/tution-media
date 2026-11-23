import { describe, expect, it } from "vitest";
import {
  ADMIN_VIEWS,
  buildSections,
  isSearchShortcut,
  pageEntries,
  personHref,
  rankEntries,
  viewEntries,
  widgetEntries,
  type NavPage,
  type PeopleState,
} from "@/lib/admin-search";

const NAV: NavPage[] = [
  {
    href: "/dashboard/admin",
    label: "Dashboard",
    description: "Where the business is stuck.",
  },
  {
    href: "/dashboard/admin/payments",
    label: "Payments",
    description: "Online payments, and the ones that need a decision.",
  },
  {
    href: "/dashboard/admin/packages",
    label: "Packages",
    description: "Approve new packages before students can see them.",
  },
  {
    href: "/dashboard/admin/accounts",
    label: "Accounts",
    description: "Find students, tutors and admins.",
  },
];

const NO_PEOPLE: PeopleState = { status: "idle" };

function build(
  query: string,
  extra: Partial<Parameters<typeof buildSections>[0]> = {},
) {
  return buildSections({
    query,
    pages: pageEntries(NAV),
    views: viewEntries(),
    widgets: null,
    people: NO_PEOPLE,
    dashboardFull: false,
    ...extra,
  });
}

describe("ADMIN_VIEWS", () => {
  it("has unique hrefs that all start with /dashboard/admin", () => {
    const hrefs = ADMIN_VIEWS.map((view) => view.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      expect(href.startsWith("/dashboard/admin")).toBe(true);
    }
  });

  it("has unique titles and a useful number of entries", () => {
    const titles = ADMIN_VIEWS.map((view) => view.title);
    expect(new Set(titles).size).toBe(titles.length);
    expect(ADMIN_VIEWS.length).toBeGreaterThanOrEqual(25);
    expect(ADMIN_VIEWS.length).toBeLessThanOrEqual(45);
  });

  it("only links to query params the pages read", () => {
    const allowed = [
      "view",
      "status",
      "kind",
      "queue",
      "role",
      "rating",
      "entityType",
      "tab",
      "hours",
      "block",
    ];
    for (const view of ADMIN_VIEWS) {
      const params = new URL(view.href, "https://x.test").searchParams;
      for (const key of params.keys()) {
        expect(allowed).toContain(key);
      }
    }
  });

  it("gives every view a page subtitle", () => {
    const [first] = viewEntries();
    expect(first?.subtitle).toBe("Payments");
  });
});

describe("rankEntries", () => {
  const entries = [
    { title: "Refunds", extra: ["payments back to tutors"] },
    { title: "Payments", extra: ["money"] },
    { title: "Fees", extra: ["payments collected"] },
  ];

  it("ranks a title hit above a keyword hit", () => {
    const ranked = rankEntries("payments", entries);
    expect(ranked[0]?.entry.title).toBe("Payments");
    expect(ranked[0]?.ranges).toEqual([[0, 8]]);
  });

  it("returns nothing for an empty query", () => {
    expect(rankEntries("   ", entries)).toEqual([]);
  });

  it("caps the number of results", () => {
    expect(rankEntries("payments", entries, 1)).toHaveLength(1);
  });
});

describe("buildSections", () => {
  it("shows every page, in nav order, for an empty query", () => {
    const sections = build("");
    expect(sections.map((s) => s.id)).toEqual(["pages"]);
    expect(sections[0]?.options.map((o) => o.title)).toEqual(
      NAV.map((page) => page.label),
    );
  });

  it("finds the page and its views for 'pay'", () => {
    const sections = build("pay");
    const pages = sections.find((s) => s.id === "pages");
    const views = sections.find((s) => s.id === "views");
    expect(pages?.options[0]?.title).toBe("Payments");
    expect(views?.options.length).toBeGreaterThan(0);
    expect(views?.options[0]?.kind).toBe("view");
    expect(views?.options[0]?.title.startsWith("Payments")).toBe(true);
  });

  it("omits the widgets section until the layout is loaded", () => {
    expect(build("mau").some((s) => s.id === "widgets")).toBe(false);
  });

  it("marks widgets on and off the dashboard, and blocks adds when full", () => {
    const widgets = widgetEntries({
      catalog: [
        {
          id: "mau",
          title: "Monthly active users",
          description: "Who signed in",
          definition: "",
          group: "people",
          keywords: ["mau"],
        },
        {
          id: "signups",
          title: "Sign-ups",
          description: "New accounts",
          definition: "",
          group: "people",
          keywords: [],
        },
      ] as never,
      widgets: ["mau"],
    });
    const sections = build("sign-ups", {
      widgets,
      dashboardFull: true,
    });
    const option = sections
      .find((s) => s.id === "widgets")
      ?.options.find((o) => o.kind === "widget");
    expect(option).toMatchObject({
      kind: "widget",
      id: "signups",
      subtitle: "Not on your dashboard",
      onDashboard: false,
      blocked: true,
    });

    const onDashboard = build("monthly", { widgets, dashboardFull: true })
      .find((s) => s.id === "widgets")
      ?.options.find((o) => o.kind === "widget");
    expect(onDashboard).toMatchObject({
      subtitle: "On your dashboard",
      blocked: false,
    });
  });

  it("shows people with a searching status, an error line, or their rows", () => {
    const searching = build("nus", { people: { status: "searching" } });
    expect(searching[0]).toMatchObject({
      id: "people",
      status: "Searching people…",
      options: [],
    });

    const failed = build("nus", { people: { status: "error" } });
    expect(failed[0]?.status).toBe("Couldn't search people.");

    const ready = build("nus", {
      people: {
        status: "ready",
        accounts: [
          {
            id: "t_1",
            email: "nusrat@example.test",
            role: "TUTOR",
            status: "ACTIVE",
            name: "Nusrat Jahan",
            phoneNumber: null,
            phoneVerifiedAt: null,
            avatarUrl: null,
            createdAt: "2026-11-01T00:00:00.000Z",
            lastLoginAt: null,
            deletedAt: null,
          },
        ],
      },
    });
    expect(ready[0]?.options[0]).toMatchObject({
      kind: "person",
      title: "Nusrat Jahan",
      subtitle: "nusrat@example.test",
      role: "TUTOR",
      href: "/dashboard/admin/accounts/t_1",
    });
  });

  it("lists people first when they are present", () => {
    const sections = build("pay", {
      people: { status: "ready", accounts: [] },
    });
    expect(sections[0]?.id).toBe("people");
    expect(sections[0]?.status).toBe("No people match.");
  });
});

describe("personHref", () => {
  it("links to the account page", () => {
    expect(personHref("abc")).toBe("/dashboard/admin/accounts/abc");
  });
});

describe("isSearchShortcut", () => {
  const base = {
    key: "k",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
  };

  it("accepts Ctrl+K and Cmd+K, in either letter case", () => {
    expect(isSearchShortcut({ ...base, ctrlKey: true })).toBe(true);
    expect(isSearchShortcut({ ...base, metaKey: true })).toBe(true);
    expect(isSearchShortcut({ ...base, key: "K", ctrlKey: true })).toBe(true);
  });

  it("rejects plain K, Alt and Shift combinations", () => {
    expect(isSearchShortcut(base)).toBe(false);
    expect(isSearchShortcut({ ...base, ctrlKey: true, altKey: true })).toBe(
      false,
    );
    expect(isSearchShortcut({ ...base, ctrlKey: true, shiftKey: true })).toBe(
      false,
    );
    expect(isSearchShortcut({ ...base, key: "j", ctrlKey: true })).toBe(false);
  });
});
