import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import {
  GROUP_LABEL,
  type DashboardLayout,
  type WidgetId,
} from "./admin-dashboard";
import { searchEntries, type Range } from "./fuzzy";

// The command palette's sources: pages, curated views, dashboard widgets and people.
// Pure apart from the people query at the bottom.

export const SEARCH_DEBOUNCE_MS = 250;
export const PEOPLE_MIN_CHARS = 2;
export const PEOPLE_LIMIT = 5;
export const STATIC_LIMIT = 6;
const PEOPLE_SCORE = 1500;
export const DASHBOARD_HREF = "/dashboard/admin";

export type NavPage = { href: string; label: string; description: string };

export type StaticEntry = {
  key: string;
  title: string;
  /** Matched after the title, at half weight. */
  extra: string[];
  href: string;
  subtitle?: string;
};

export type WidgetEntry = {
  key: string;
  id: WidgetId;
  title: string;
  extra: string[];
  onDashboard: boolean;
};

export type Ranked<T> = { entry: T; ranges: Range[]; score: number };

type ViewLink = { title: string; keywords: string[]; href: string };

/**
 * Deep links into sub-views. Each param below is read by its page in components/admin
 * (the page named in the comment). Settings and Team have no URL views, so they are absent.
 */
export const ADMIN_VIEWS: ViewLink[] = [
  // payments-page.tsx: ?view=
  {
    title: "Payments · Needs attention",
    keywords: ["review", "unapplied", "decision", "stuck"],
    href: "/dashboard/admin/payments?view=attention",
  },
  {
    title: "Payments · Under review",
    keywords: ["review", "check", "approve", "reject"],
    href: "/dashboard/admin/payments?view=review",
  },
  {
    title: "Payments · Unapplied",
    keywords: ["unapplied", "unmatched", "money"],
    href: "/dashboard/admin/payments?view=unapplied",
  },
  {
    title: "Payments · Failed",
    keywords: ["declined", "failed", "gateway"],
    href: "/dashboard/admin/payments?view=failed",
  },
  {
    title: "Payments · Succeeded",
    keywords: ["paid", "success", "collected"],
    href: "/dashboard/admin/payments?view=succeeded",
  },
  // refunds-page.tsx: ?view=
  {
    title: "Refunds · Open",
    keywords: ["in progress", "requested", "processing"],
    href: "/dashboard/admin/refunds?view=open",
  },
  {
    title: "Refunds · Needs review",
    keywords: ["gateway", "unclear", "check", "resolve"],
    href: "/dashboard/admin/refunds?view=NEEDS_REVIEW",
  },
  // fees-page.tsx: ?view=
  {
    title: "Fees · Overdue",
    keywords: ["late", "past due", "unpaid"],
    href: "/dashboard/admin/fees?view=overdue",
  },
  {
    title: "Fees · Due",
    keywords: ["unpaid", "open", "outstanding"],
    href: "/dashboard/admin/fees?view=due",
  },
  {
    title: "Fees · Partly paid",
    keywords: ["partial", "part payment"],
    href: "/dashboard/admin/fees?view=partial",
  },
  // verifications-page.tsx: ?kind= and ?status=
  {
    title: "Verifications · Tutors",
    keywords: ["tutor id", "id", "documents", "verify"],
    href: "/dashboard/admin/verifications?kind=tutors",
  },
  {
    title: "Verifications · Students",
    keywords: ["student id", "id", "documents", "verify"],
    href: "/dashboard/admin/verifications?kind=students",
  },
  {
    title: "Verifications · Rejected",
    keywords: ["rejected", "declined", "id"],
    href: "/dashboard/admin/verifications?status=REJECTED",
  },
  // packages-page.tsx: ?status=
  {
    title: "Packages · Waiting for review",
    keywords: ["approve", "pending", "new package"],
    href: "/dashboard/admin/packages?status=pending",
  },
  {
    title: "Packages · Rejected",
    keywords: ["rejected", "changes needed"],
    href: "/dashboard/admin/packages?status=rejected",
  },
  // videos-page.tsx: ?status=
  {
    title: "Videos · Waiting for review",
    keywords: ["approve", "pending", "teaching video"],
    href: "/dashboard/admin/videos?status=PENDING",
  },
  // reviews-page.tsx: ?view= and ?rating=
  {
    title: "Reviews · Hidden",
    keywords: ["hidden", "restore", "show again"],
    href: "/dashboard/admin/reviews?view=hidden",
  },
  {
    title: "Reviews · 1 star",
    keywords: ["one star", "rating", "bad", "low"],
    href: "/dashboard/admin/reviews?rating=1",
  },
  // stories-page.tsx: ?status= and ?role=
  {
    title: "Stories · Waiting for review",
    keywords: ["approve", "pending", "testimonial", "home page"],
    href: "/dashboard/admin/stories?status=PENDING",
  },
  {
    title: "Stories · Tutors",
    keywords: ["tutor story", "showcase"],
    href: "/dashboard/admin/stories?role=TUTOR",
  },
  // reports-page.tsx and disputes-page.tsx: ?queue=
  {
    title: "Reports · Closed",
    keywords: ["resolved", "dismissed", "handled"],
    href: "/dashboard/admin/reports?queue=closed",
  },
  {
    title: "Disputes · Closed",
    keywords: ["resolved", "dismissed", "handled"],
    href: "/dashboard/admin/disputes?queue=closed",
  },
  // zone-requests-page.tsx: ?status=
  {
    title: "Zone requests · Denied",
    keywords: ["declined", "rejected", "more zones"],
    href: "/dashboard/admin/zone-requests?status=denied",
  },
  // applications-page.tsx: ?status= and ?kind=
  {
    title: "Applications · Packages",
    keywords: ["package requests", "packages"],
    href: "/dashboard/admin/applications?kind=PACKAGE",
  },
  {
    title: "Applications · Confirmed",
    keywords: ["hired", "confirmed", "accepted"],
    href: "/dashboard/admin/applications?status=CONFIRMED",
  },
  // accounts-page.tsx: ?role= and ?status=
  {
    title: "Accounts · Tutors",
    keywords: ["tutors", "teachers"],
    href: "/dashboard/admin/accounts?role=TUTOR",
  },
  {
    title: "Accounts · Blocked",
    keywords: ["blocked", "banned", "unblock"],
    href: "/dashboard/admin/accounts?status=BLOCKED",
  },
  {
    title: "Accounts · Admins",
    keywords: ["admins", "staff"],
    href: "/dashboard/admin/accounts?role=ADMIN",
  },
  {
    title: "Accounts · Deactivated",
    keywords: ["deactivated", "deleted", "closed"],
    href: "/dashboard/admin/accounts?status=DELETED",
  },
  // audit-log-page.tsx: ?entityType=
  {
    title: "Audit log · Payments",
    keywords: ["payment changes", "history", "who changed"],
    href: "/dashboard/admin/audit-log?entityType=fee_payment",
  },
  {
    title: "Audit log · Accounts",
    keywords: ["account changes", "block", "history"],
    href: "/dashboard/admin/audit-log?entityType=account",
  },
  {
    title: "Audit log · Settings",
    keywords: ["commission", "switch", "setting changes"],
    href: "/dashboard/admin/audit-log?entityType=platform_setting",
  },
  // matching-page.tsx: ?tab= and ?hours=
  {
    title: "Matching · Unmatched requirements",
    keywords: ["unmatched", "no tutor", "stuck", "requirements"],
    href: "/dashboard/admin/matching?tab=unmatched",
  },
  {
    title: "Matching · Unmatched, last 72 hours",
    keywords: ["unmatched", "three days", "72"],
    href: "/dashboard/admin/matching?tab=unmatched&hours=72",
  },
  {
    title: "Matching · Explain a match",
    keywords: ["why", "explain", "match score", "reasons"],
    href: "/dashboard/admin/matching?tab=explain",
  },
  {
    title: "Matching · Cities",
    keywords: ["city", "boundary", "areas", "zones"],
    href: "/dashboard/admin/matching?tab=cities",
  },
  // site-content-page.tsx: ?block=
  {
    title: "Site content · Testimonials",
    keywords: ["stories", "landing", "home page", "quotes"],
    href: "/dashboard/admin/site-content?block=testimonials",
  },
  {
    title: "Site content · FAQ",
    keywords: ["questions", "landing", "help"],
    href: "/dashboard/admin/site-content?block=faq",
  },
  {
    title: "Site content · Terms page",
    keywords: ["terms", "legal", "conditions"],
    href: "/dashboard/admin/site-content?block=terms_page",
  },
];

export function pageEntries(nav: readonly NavPage[]): StaticEntry[] {
  return nav.map((page) => ({
    key: `page:${page.href}`,
    title: page.label,
    extra: [page.description],
    href: page.href,
    subtitle: page.description,
  }));
}

export function viewEntries(
  views: readonly ViewLink[] = ADMIN_VIEWS,
): StaticEntry[] {
  return views.map((view) => ({
    key: `view:${view.href}`,
    title: view.title,
    extra: view.keywords,
    href: view.href,
    subtitle: view.title.split(" · ")[0],
  }));
}

export function widgetEntries(
  layout: Pick<DashboardLayout, "catalog" | "widgets">,
): WidgetEntry[] {
  const onDashboard = new Set<WidgetId>(layout.widgets);
  return layout.catalog.map((item) => ({
    key: `widget:${item.id}`,
    id: item.id,
    title: item.title,
    extra: [
      item.description,
      item.definition,
      GROUP_LABEL[item.group],
      ...item.keywords,
    ],
    onDashboard: onDashboard.has(item.id),
  }));
}

/** Ranks by the title first, then by the extra text (see searchEntries). Empty query ranks nothing. */
export function rankEntries<T extends { title: string; extra: string[] }>(
  query: string,
  entries: T[],
  limit = STATIC_LIMIT,
): Ranked<T>[] {
  return searchEntries(
    query,
    entries,
    (entry) => ({ title: entry.title, extra: entry.extra }),
    limit,
  ).map(({ entry, ranges, score }) => ({ entry, ranges, score }));
}

export type PeopleState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "error" }
  | { status: "ready"; accounts: Schemas["AdminAccountSummary"][] };

export type PaletteOption =
  | {
      kind: "page" | "view";
      key: string;
      title: string;
      subtitle?: string;
      href: string;
      ranges: Range[];
      score: number;
    }
  | {
      kind: "person";
      key: string;
      title: string;
      subtitle: string;
      role: Schemas["AdminAccountSummary"]["role"];
      href: string;
      score: number;
    }
  | {
      kind: "widget";
      key: string;
      id: WidgetId;
      title: string;
      subtitle: string;
      onDashboard: boolean;
      blocked: boolean;
      ranges: Range[];
      score: number;
    };

export type PaletteSection = {
  id: "people" | "pages" | "views" | "widgets";
  label: string;
  options: PaletteOption[];
  /** A status row shown in place of options (people only). */
  status?: string;
};

export const ROLE_LABEL: Record<
  Schemas["AdminAccountSummary"]["role"],
  string
> = {
  STUDENT: "Student",
  TUTOR: "Tutor",
  ADMIN: "Admin",
};

export function personHref(id: string) {
  return `/dashboard/admin/accounts/${id}`;
}

/**
 * The palette's sections in display order. With an empty query only Pages shows, all of them,
 * so the palette doubles as a quick nav. Otherwise each static source is ranked and capped.
 */
export function buildSections(input: {
  query: string;
  pages: StaticEntry[];
  views: StaticEntry[];
  widgets: WidgetEntry[] | null;
  people: PeopleState;
  dashboardFull: boolean;
}): PaletteSection[] {
  const { query, pages, views, widgets, people, dashboardFull } = input;
  const typed = query.trim() !== "";
  const sections: PaletteSection[] = [];

  if (people.status !== "idle") {
    const accounts = people.status === "ready" ? people.accounts : [];
    sections.push({
      id: "people",
      label: "People",
      options: accounts.map((account) => ({
        kind: "person",
        key: `person:${account.id}`,
        title: account.name ?? account.email,
        subtitle: account.name ? account.email : "No name yet",
        role: account.role,
        href: personHref(account.id),
        // A server-matched person outranks any fuzzy page or view hit.
        score: PEOPLE_SCORE,
      })),
      status:
        people.status === "searching"
          ? "Searching people…"
          : people.status === "error"
            ? "Couldn't search people."
            : accounts.length === 0
              ? "No people match."
              : undefined,
    });
  }

  const pageRanks: Ranked<StaticEntry>[] = typed
    ? rankEntries(query, pages)
    : pages.map((entry) => ({ entry, ranges: [], score: 0 }));
  if (pageRanks.length > 0) {
    sections.push({
      id: "pages",
      label: "Pages",
      options: pageRanks.map(({ entry, ranges, score }) =>
        staticOption("page", entry, ranges, score),
      ),
    });
  }

  if (typed) {
    const viewRanks = rankEntries(query, views);
    if (viewRanks.length > 0) {
      sections.push({
        id: "views",
        label: "Views",
        options: viewRanks.map(({ entry, ranges, score }) =>
          staticOption("view", entry, ranges, score),
        ),
      });
    }
    if (widgets) {
      const widgetRanks = rankEntries(query, widgets);
      if (widgetRanks.length > 0) {
        sections.push({
          id: "widgets",
          label: "Dashboard widgets",
          options: widgetRanks.map(({ entry, ranges, score }) => ({
            kind: "widget",
            key: entry.key,
            id: entry.id,
            title: entry.title,
            subtitle: entry.onDashboard
              ? "On your dashboard"
              : "Not on your dashboard",
            onDashboard: entry.onDashboard,
            blocked: !entry.onDashboard && dashboardFull,
            ranges,
            score,
          })),
        });
      }
    }
  }

  return sections;
}

function staticOption(
  kind: "page" | "view",
  entry: StaticEntry,
  ranges: Range[],
  score: number,
): PaletteOption {
  return {
    kind,
    key: entry.key,
    title: entry.title,
    subtitle: entry.subtitle,
    href: entry.href,
    ranges,
    score,
  };
}

/** Ctrl+K or Cmd+K with no Alt or Shift. */
export function isSearchShortcut(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}) {
  return (
    e.key.toLowerCase() === "k" &&
    (e.metaKey || e.ctrlKey) &&
    !e.altKey &&
    !e.shiftKey
  );
}

export const peopleQueryKey = (q: string) =>
  ["admin", "search", "people", q] as const;

/** Live account search through GET /admin/accounts (the same query the accounts page uses). */
export function usePeopleSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: peopleQueryKey(q),
    queryFn: async () => {
      const page = await unwrap(
        client.GET("/api/v1/admin/accounts", {
          params: { query: { q, limit: PEOPLE_LIMIT } },
        }),
      );
      return page.accounts;
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: 1,
  });
}
