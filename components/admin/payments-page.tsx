"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { card, focusRing } from "@/components/profile/styles";
import {
  AdminPage,
  DetailList,
  FilterChips,
  LoadMore,
  QueryState,
  StatusPill,
} from "@/components/admin/admin-ui";
import { formatAmount, formatDateTime } from "@/lib/admin";
import { useIntentPrefetch } from "@/lib/prefetch";
import {
  ATTEMPT_STATUS_META,
  adminPaymentAttemptQueryOptions,
  useAdminPaymentAttempts,
  useAdminPaymentSummary,
  type AdminPaymentAttempt,
  type AdminPaymentFilters,
  type AdminPaymentSummary,
} from "@/lib/admin-payments";

type View =
  | "attention"
  | "all"
  | "pending"
  | "succeeded"
  | "review"
  | "unapplied"
  | "failed"
  | "cancelled"
  | "expired";

const VIEWS: { value: View; label: string; filters: AdminPaymentFilters }[] = [
  {
    value: "attention",
    label: "Needs attention",
    filters: { attention: true },
  },
  { value: "all", label: "All", filters: {} },
  {
    value: "pending",
    label: ATTEMPT_STATUS_META.PENDING.label,
    filters: { status: "PENDING" },
  },
  {
    value: "succeeded",
    label: ATTEMPT_STATUS_META.SUCCEEDED.label,
    filters: { status: "SUCCEEDED" },
  },
  {
    value: "review",
    label: ATTEMPT_STATUS_META.REVIEW.label,
    filters: { status: "REVIEW" },
  },
  {
    value: "unapplied",
    label: ATTEMPT_STATUS_META.UNAPPLIED.label,
    filters: { status: "UNAPPLIED" },
  },
  {
    value: "failed",
    label: ATTEMPT_STATUS_META.FAILED.label,
    filters: { status: "FAILED" },
  },
  {
    value: "cancelled",
    label: ATTEMPT_STATUS_META.CANCELLED.label,
    filters: { status: "CANCELLED" },
  },
  {
    value: "expired",
    label: ATTEMPT_STATUS_META.EXPIRED.label,
    filters: { status: "EXPIRED" },
  },
];

const VIEW_VALUES = new Set<string>(VIEWS.map((v) => v.value));

const EMPTY_TEXT: Record<View, string> = {
  attention:
    "Nothing needs a decision. Flagged and unapplied payments show up here.",
  all: "No online payments yet.",
  pending: "No payments in this view.",
  succeeded: "No payments in this view.",
  review: "No payments in this view.",
  unapplied: "No payments in this view.",
  failed: "No payments in this view.",
  cancelled: "No payments in this view.",
  expired: "No payments in this view.",
};

export function AdminPaymentsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("view") ?? "attention";
  const view: View = VIEW_VALUES.has(raw) ? (raw as View) : "attention";
  const filters = VIEWS.find((v) => v.value === view)?.filters ?? {};
  const query = useAdminPaymentAttempts(filters);
  const attempts = query.data?.pages.flatMap((p) => p.attempts) ?? [];

  // The view lives in the URL. The default view drops its param so the bare path stays clean.
  function setView(next: View) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "attention") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Payments"
      description="Online fee payments through SSLCommerz. This view opens on the ones that need a decision."
    >
      <SummaryStrip />

      <FilterChips
        label="Payment view"
        value={view}
        options={VIEWS}
        onChange={setView}
      />

      <QueryState
        query={query}
        isEmpty={attempts.length === 0}
        loadingLabel="Loading payments"
        errorText="Couldn't load payments."
        emptyText={EMPTY_TEXT[view]}
      >
        <ul className="grid gap-4">
          {attempts.map((attempt) => (
            <li key={attempt.id}>
              <AttemptRow attempt={attempt} />
            </li>
          ))}
        </ul>
        <LoadMore query={query} />
      </QueryState>
    </AdminPage>
  );
}

/** Four counts at a glance. A non-zero count that needs a decision gets the warning or error accent. */
function SummaryStrip() {
  const summary = useAdminPaymentSummary();
  if (summary.isError) return null;

  const data: AdminPaymentSummary | undefined = summary.data;
  const shown = (value: number | undefined) =>
    value === undefined ? "–" : String(value);

  return (
    <ul
      aria-label="Payment summary"
      aria-busy={data === undefined}
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      <StatTile
        label="Needs review"
        value={shown(data?.review)}
        tone={data && data.review > 0 ? "warning" : "neutral"}
      />
      <StatTile
        label="Not applied"
        value={shown(data?.unapplied)}
        tone={data && data.unapplied > 0 ? "error" : "neutral"}
      />
      <StatTile
        label="Stuck over an hour"
        value={shown(data?.stalePending)}
        tone="neutral"
      />
      <StatTile
        label="Paid in the last 24 h"
        value={shown(data?.succeeded24h)}
        tone="neutral"
        detail={
          data ? `${formatAmount(data.collected24h)} collected` : undefined
        }
      />
    </ul>
  );
}

const TILE_TONE = {
  neutral: { surface: "", value: "text-[var(--color-neutral-charcoal)]" },
  warning: {
    surface: "bg-[var(--color-semantic-warning-surface)]",
    value: "text-[var(--color-semantic-warning-text)]",
  },
  error: {
    surface: "bg-[var(--color-semantic-error-surface)]",
    value: "text-[var(--color-semantic-error-text)]",
  },
} as const;

function StatTile({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: keyof typeof TILE_TONE;
  detail?: string;
}) {
  return (
    <li
      className={cn(
        card,
        "flex min-w-0 flex-col p-4 sm:p-5",
        TILE_TONE[tone].surface,
      )}
    >
      <p className="text-xs font-medium text-pretty text-[var(--color-text-secondary)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums",
          TILE_TONE[tone].value,
        )}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-1 text-xs break-words text-[var(--color-text-secondary)] tabular-nums">
          {detail}
        </p>
      )}
    </li>
  );
}

function AttemptRow({ attempt }: { attempt: AdminPaymentAttempt }) {
  const meta = ATTEMPT_STATUS_META[attempt.status];
  const intent = useIntentPrefetch();
  const items = [
    { label: "Total", value: formatAmount(attempt.totalAmount) },
    { label: "Fee part", value: formatAmount(attempt.feeAmount) },
    { label: "Started", value: formatDateTime(attempt.createdAt) },
    ...(attempt.settledAt
      ? [{ label: "Settled", value: formatDateTime(attempt.settledAt) }]
      : []),
  ];

  return (
    <Link
      href={`/dashboard/admin/payments/${encodeURIComponent(attempt.tranId)}`}
      {...intent(adminPaymentAttemptQueryOptions(attempt.tranId))}
      className={cn(card, "grid gap-4 p-5", focusRing)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
            {attempt.tutor.name}
          </p>
          <p className="mt-1 font-mono text-xs break-all text-[var(--color-text-secondary)]">
            {attempt.tranId}
          </p>
        </div>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>
      <DetailList items={items} />
      {attempt.failureReason && (
        <p className="line-clamp-2 text-sm break-words text-[var(--color-text-secondary)]">
          {attempt.failureReason}
        </p>
      )}
    </Link>
  );
}
