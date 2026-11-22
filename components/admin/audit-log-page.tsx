"use client";

import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { card, focusRing } from "@/components/profile/styles";
import {
  AdminPage,
  FilterChips,
  LoadMore,
  QueryState,
} from "@/components/admin/admin-ui";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { formatDateTime } from "@/lib/admin";
import {
  actionLabel,
  actorName,
  formatSnapshot,
  useAuditLog,
  type AuditEntry,
  type AuditFilters,
} from "@/lib/admin-audit";

const PATH = "/dashboard/admin/audit-log";
const ALL = "all";

/** Chip values are the API's entityType strings, except "all" which clears the filter. */
const ENTITY_FILTERS: { value: string; label: string }[] = [
  { value: ALL, label: "All" },
  { value: "platform_fee", label: "Fees" },
  { value: "fee_payment", label: "Payments" },
  { value: "account", label: "Accounts" },
  { value: "admin_user", label: "Admins" },
  { value: "tuition_package", label: "Packages" },
  { value: "subject", label: "Subjects" },
  { value: "platform_setting", label: "Settings" },
  { value: "zone_limit_request", label: "Zone requests" },
];

function entityFromParam(value: string | null): string {
  return ENTITY_FILTERS.some((f) => f.value === value && f.value !== ALL)
    ? (value as string)
    : ALL;
}

export function AuditLogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityType = entityFromParam(searchParams.get("entityType"));
  const filters: AuditFilters = entityType === ALL ? {} : { entityType };
  const audit = useAuditLog(filters);
  const entries = audit.data?.pages.flatMap((page) => page.entries) ?? [];

  function onFilterChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete("entityType");
    else params.set("entityType", value);
    const query = params.toString();
    router.replace(query ? `${PATH}?${query}` : PATH, { scroll: false });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Audit log"
      description="Every admin change, newest first."
    >
      <FilterChips
        label="Entity type"
        value={entityType}
        options={ENTITY_FILTERS}
        onChange={onFilterChange}
      />

      <QueryState
        query={audit}
        isEmpty={entries.length === 0}
        loadingLabel="Loading the audit log"
        errorText="Couldn't load the audit log."
        emptyText="No changes match this filter yet."
      >
        <ul className="grid gap-4">
          {entries.map((entry, index) => (
            <AuditRow
              key={entry.id}
              entry={entry}
              className={enterClass}
              style={enterStyle(index)}
            />
          ))}
        </ul>
        <LoadMore query={audit} />
      </QueryState>
    </AdminPage>
  );
}

function AuditRow({
  entry,
  className,
  style,
}: {
  entry: AuditEntry;
  className?: string;
  style?: CSSProperties;
}) {
  const actor = entry.actor;
  return (
    <li className={cn(card, "grid gap-4 p-5", className)} style={style}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <p className="font-semibold text-[var(--color-neutral-charcoal)]">
          {actionLabel(entry.action)}
        </p>
        <time
          dateTime={entry.createdAt}
          className="text-xs text-[var(--color-text-secondary)] tabular-nums"
        >
          {formatDateTime(entry.createdAt)}
        </time>
      </div>

      <div className="grid gap-1 text-sm">
        <p className="text-[var(--color-neutral-charcoal)]">
          {actorName(actor)}
        </p>
        {actor?.name && (
          <p className="text-xs break-all text-[var(--color-text-secondary)]">
            {actor.email}
          </p>
        )}
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs text-[var(--color-text-secondary)]">
          <span>{entry.entityType}</span>
          <code
            title={entry.entityId}
            className="max-w-full min-w-0 truncate font-mono text-[var(--color-neutral-charcoal)]"
          >
            {entry.entityId}
          </code>
        </p>
      </div>

      <details>
        <summary
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center rounded-full text-sm font-semibold text-[var(--color-primary-core)] hover:text-[var(--color-primary-deep)]",
            focusRing,
          )}
        >
          Show changes
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Snapshot label="Before" value={entry.before} />
          <Snapshot label="After" value={entry.after} />
        </div>
      </details>
    </li>
  );
}

function Snapshot({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </p>
      <pre className="overflow-x-auto rounded-[16px] bg-[var(--color-neutral-off-white)] p-3 text-xs text-[var(--color-neutral-charcoal)]">
        {formatSnapshot(value)}
      </pre>
    </div>
  );
}
