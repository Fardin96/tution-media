"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { card, focusRing } from "@/components/profile/styles";
import {
  AdminPage,
  FilterChips,
  LoadMore,
  QueryState,
} from "@/components/admin/admin-ui";
import { CaseStatusPill, Parties } from "@/components/admin/case-parts";
import { formatDateTime } from "@/lib/admin";
import {
  REPORT_CATEGORY_LABEL,
  adminReportQueryOptions,
  ageText,
  partyName,
  useAdminReports,
  type AdminReport,
  type CaseQueue,
  type ReportCategory,
} from "@/lib/admin-cases";
import { useIntentPrefetch } from "@/lib/prefetch";

const QUEUES: { value: CaseQueue; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

type CategoryView = ReportCategory | "all";

const CATEGORIES: { value: CategoryView; label: string }[] = [
  { value: "all", label: "Any category" },
  ...(Object.keys(REPORT_CATEGORY_LABEL) as ReportCategory[]).map((value) => ({
    value,
    label: REPORT_CATEGORY_LABEL[value],
  })),
];

const CATEGORY_VALUES = new Set<string>(Object.keys(REPORT_CATEGORY_LABEL));

export function AdminReportsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queue: CaseQueue =
    searchParams.get("queue") === "closed" ? "closed" : "open";
  const rawCategory = searchParams.get("category") ?? "";
  const category: CategoryView = CATEGORY_VALUES.has(rawCategory)
    ? (rawCategory as ReportCategory)
    : "all";

  const query = useAdminReports({
    queue,
    category: category === "all" ? undefined : category,
  });
  const reports = query.data?.pages.flatMap((p) => p.reports) ?? [];

  // Filters live in the URL. Defaults drop their param so the bare path stays clean.
  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Reports"
      description="Reports about people. Open shows the oldest first. Closed shows the latest."
    >
      <div className="grid gap-3">
        <FilterChips
          label="Report queue"
          value={queue}
          options={QUEUES}
          onChange={(next) => setParam("queue", next === "open" ? null : next)}
        />
        <FilterChips
          label="Report category"
          value={category}
          options={CATEGORIES}
          onChange={(next) =>
            setParam("category", next === "all" ? null : next)
          }
        />
      </div>

      <QueryState
        query={query}
        isEmpty={reports.length === 0}
        loadingLabel="Loading reports"
        errorText="Couldn't load reports."
        emptyText={
          queue === "open" ? "No open reports." : "No closed reports yet."
        }
      >
        <ul className="grid gap-4">
          {reports.map((report) => (
            <li key={report.id}>
              <ReportRow report={report} />
            </li>
          ))}
        </ul>
        <LoadMore query={query} />
      </QueryState>
    </AdminPage>
  );
}

function ReportRow({ report }: { report: AdminReport }) {
  const intent = useIntentPrefetch();
  return (
    <Link
      href={`/dashboard/admin/reports/${encodeURIComponent(report.id)}`}
      {...intent(adminReportQueryOptions(report.id))}
      className={cn(card, "grid gap-3 p-5", focusRing)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 font-semibold break-words text-[var(--color-neutral-charcoal)]">
          {REPORT_CATEGORY_LABEL[report.category]}
        </p>
        <CaseStatusPill status={report.status} />
      </div>
      <p className="text-sm text-[var(--color-neutral-charcoal)]">
        <Parties
          from={partyName(report.reporter)}
          to={partyName(report.target)}
          word="reported"
        />
      </p>
      <p className="line-clamp-2 text-sm break-words text-[var(--color-text-secondary)]">
        {report.details}
      </p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
        <time
          dateTime={report.createdAt}
          title={formatDateTime(report.createdAt)}
        >
          {ageText(report.createdAt)}
        </time>
        <span>
          {report.handledBy
            ? `Handled by ${report.handledBy.name ?? "an admin"}`
            : "No one has taken it"}
        </span>
      </p>
    </Link>
  );
}
