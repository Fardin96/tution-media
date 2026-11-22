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
  StatusPill,
} from "@/components/admin/admin-ui";
import { formatAmount, formatDateTime } from "@/lib/admin";
import { useIntentPrefetch } from "@/lib/prefetch";
import { applicationQueryOptions, STATUS_META } from "@/lib/applications";
import {
  useAdminApplications,
  type AdminApplication,
  type AdminApplicationFilters,
  type AdminApplicationKind,
  type AdminApplicationStatus,
} from "@/lib/admin-applications";
import { FEE_STATUS_META } from "@/lib/admin-fees";
import {
  levelLabel,
  useEducationLookup,
  type EducationLookup,
} from "@/lib/education";

const STATUS_LABEL: Record<AdminApplicationStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const STATUS_OPTIONS: {
  value: "ALL" | AdminApplicationStatus;
  label: string;
}[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: STATUS_LABEL.PENDING },
  { value: "CONFIRMED", label: STATUS_LABEL.CONFIRMED },
  { value: "COMPLETED", label: STATUS_LABEL.COMPLETED },
  { value: "REJECTED", label: STATUS_LABEL.REJECTED },
  { value: "WITHDRAWN", label: STATUS_LABEL.WITHDRAWN },
  { value: "CANCELLED", label: STATUS_LABEL.CANCELLED },
  { value: "EXPIRED", label: STATUS_LABEL.EXPIRED },
];

const KIND_OPTIONS: { value: "BOTH" | AdminApplicationKind; label: string }[] =
  [
    { value: "BOTH", label: "Both" },
    { value: "REQUIREMENT", label: "Requirements" },
    { value: "PACKAGE", label: "Packages" },
  ];

const STATUS_VALUES = new Set<string>(STATUS_OPTIONS.map((o) => o.value));
const KIND_VALUES = new Set<string>(KIND_OPTIONS.map((o) => o.value));

export function AdminApplicationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lookup = useEducationLookup();

  const rawStatus = searchParams.get("status") ?? "ALL";
  const rawKind = searchParams.get("kind") ?? "BOTH";
  const status = STATUS_VALUES.has(rawStatus)
    ? (rawStatus as "ALL" | AdminApplicationStatus)
    : "ALL";
  const kind = KIND_VALUES.has(rawKind)
    ? (rawKind as "BOTH" | AdminApplicationKind)
    : "BOTH";

  const filters: AdminApplicationFilters = {
    status: status === "ALL" ? undefined : status,
    kind: kind === "BOTH" ? undefined : kind,
  };
  const query = useAdminApplications(filters);
  const applications = query.data?.pages.flatMap((p) => p.applications) ?? [];
  const filtered = status !== "ALL" || kind !== "BOTH";

  // Filters live in the URL. The default value drops its param so the bare path stays clean.
  function setParam(key: string, value: string, fallback: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Applications"
      description="Every tutor application and package request. Read-only."
    >
      <div className="grid gap-3">
        <FilterChips
          label="Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => setParam("status", value, "ALL")}
        />
        <FilterChips
          label="Kind"
          value={kind}
          options={KIND_OPTIONS}
          onChange={(value) => setParam("kind", value, "BOTH")}
        />
      </div>

      <QueryState
        query={query}
        isEmpty={applications.length === 0}
        loadingLabel="Loading applications"
        errorText="Couldn't load applications."
        emptyText={
          filtered
            ? "No applications match these filters."
            : "No applications yet."
        }
      >
        <ul className="grid gap-4">
          {applications.map((application) => (
            <li key={application.id}>
              <ApplicationRow
                application={application}
                levelText={targetLevel(lookup.data, application)}
              />
            </li>
          ))}
        </ul>
        <LoadMore query={query} />
      </QueryState>
    </AdminPage>
  );
}

function targetLevel(
  lookup: EducationLookup | undefined,
  application: AdminApplication,
): string | null {
  const { levelCode, curriculum } = application.target;
  if (levelCode === null) return null;
  return levelLabel(lookup, curriculum, levelCode) ?? `Level ${levelCode}`;
}

function ApplicationRow({
  application,
  levelText,
}: {
  application: AdminApplication;
  levelText: string | null;
}) {
  const { kind, status, fee, target } = application;
  const intent = useIntentPrefetch();
  const isPackage = kind === "PACKAGE";
  const targetText = isPackage
    ? (target.title ?? "Package")
    : ["Requirement", levelText].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/dashboard/applications/${encodeURIComponent(application.id)}?from=admin`}
      {...intent(applicationQueryOptions(application.id))}
      className={cn(card, "grid gap-3 p-5", focusRing)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
            {application.tutor.name} → {application.student.name}
          </p>
          <p className="mt-1 text-sm break-words text-[var(--color-text-secondary)]">
            {targetText}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone="neutral">
            {isPackage ? "Package" : "Requirement"}
          </StatusPill>
          <StatusPill tone={STATUS_META[status].tone}>
            {STATUS_LABEL[status]}
          </StatusPill>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs text-[var(--color-text-secondary)] tabular-nums">
        <p>Applied {formatDateTime(application.appliedAt)}</p>
        {fee && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-neutral-charcoal)]">
            <span>
              Fee {formatAmount(fee.amountDue)} · Paid{" "}
              {formatAmount(fee.amountPaid)}
            </span>
            <StatusPill tone={FEE_STATUS_META[fee.status].tone}>
              {FEE_STATUS_META[fee.status].label}
            </StatusPill>
          </div>
        )}
      </div>
    </Link>
  );
}
