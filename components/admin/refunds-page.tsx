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
import {
  REFUND_STATUS_META,
  useAdminRefunds,
  type AdminRefund,
  type AdminRefundFilters,
} from "@/lib/admin-refunds";

type View =
  | "open"
  | "all"
  | "REQUESTED"
  | "NEEDS_REVIEW"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "REJECTED";

const VIEWS: { value: View; label: string; filters: AdminRefundFilters }[] = [
  { value: "open", label: "In progress", filters: { open: true } },
  { value: "all", label: "All", filters: {} },
  {
    value: "REQUESTED",
    label: REFUND_STATUS_META.REQUESTED.label,
    filters: { status: "REQUESTED" },
  },
  {
    value: "NEEDS_REVIEW",
    label: REFUND_STATUS_META.NEEDS_REVIEW.label,
    filters: { status: "NEEDS_REVIEW" },
  },
  {
    value: "PROCESSING",
    label: REFUND_STATUS_META.PROCESSING.label,
    filters: { status: "PROCESSING" },
  },
  {
    value: "SUCCEEDED",
    label: REFUND_STATUS_META.SUCCEEDED.label,
    filters: { status: "SUCCEEDED" },
  },
  {
    value: "FAILED",
    label: REFUND_STATUS_META.FAILED.label,
    filters: { status: "FAILED" },
  },
  {
    value: "REJECTED",
    label: REFUND_STATUS_META.REJECTED.label,
    filters: { status: "REJECTED" },
  },
];

const VIEW_VALUES = new Set<string>(VIEWS.map((v) => v.value));

const EMPTY_TEXT: Record<View, string> = {
  open: "No refunds in progress.",
  all: "No refunds yet.",
  REQUESTED: "No refunds in this view.",
  NEEDS_REVIEW: "No refunds in this view.",
  PROCESSING: "No refunds in this view.",
  SUCCEEDED: "No refunds in this view.",
  FAILED: "No refunds in this view.",
  REJECTED: "No refunds in this view.",
};

export function AdminRefundsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("view") ?? "open";
  const view: View = VIEW_VALUES.has(raw) ? (raw as View) : "open";
  const filters = VIEWS.find((v) => v.value === view)?.filters ?? {};
  const query = useAdminRefunds(filters);
  const refunds = query.data?.pages.flatMap((p) => p.refunds) ?? [];

  // The view lives in the URL. The default view drops its param so the bare path stays clean.
  function setView(next: View) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "open") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Refunds"
      description="Refunds of online fee payments. This view opens on the ones still in progress."
    >
      <FilterChips
        label="Refund view"
        value={view}
        options={VIEWS}
        onChange={setView}
      />

      <QueryState
        query={query}
        isEmpty={refunds.length === 0}
        loadingLabel="Loading refunds"
        errorText="Couldn't load refunds."
        emptyText={EMPTY_TEXT[view]}
      >
        <ul className="grid gap-4">
          {refunds.map((refund) => (
            <li key={refund.id}>
              <RefundRow refund={refund} />
            </li>
          ))}
        </ul>
        <LoadMore query={query} />
      </QueryState>
    </AdminPage>
  );
}

const SOURCE_LABEL: Record<AdminRefund["source"], string> = {
  TUTOR: "Tutor asked",
  ADMIN: "Admin started",
};

function RefundRow({ refund }: { refund: AdminRefund }) {
  const meta = REFUND_STATUS_META[refund.status];
  return (
    <Link
      href={`/dashboard/admin/refunds/${encodeURIComponent(refund.id)}`}
      className={cn(card, "grid gap-4 p-5", focusRing)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
            {refund.tutor.name}
          </p>
          <p className="mt-1 font-mono text-xs break-all text-[var(--color-text-secondary)]">
            {refund.attempt.tranId}
          </p>
        </div>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </div>
      <DetailList
        items={[
          { label: "Amount", value: formatAmount(refund.amount) },
          { label: "Source", value: SOURCE_LABEL[refund.source] },
          { label: "Created", value: formatDateTime(refund.createdAt) },
        ]}
      />
      {refund.failureReason && (
        <p className="line-clamp-2 text-sm break-words text-[var(--color-text-secondary)]">
          {refund.failureReason}
        </p>
      )}
    </Link>
  );
}

/** A compact link row for a refund, used in the refunds sections of the fee and payment pages. */
export function RefundLinkRow({ refund }: { refund: AdminRefund }) {
  const meta = REFUND_STATUS_META[refund.status];
  return (
    <li>
      <Link
        href={`/dashboard/admin/refunds/${encodeURIComponent(refund.id)}`}
        className={cn(
          "grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4 transition-[box-shadow] duration-150 ease-out hover:shadow-[0_0_0_1px_rgb(0_0_0/0.1)] motion-reduce:transition-none",
          focusRing,
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
            {formatAmount(refund.amount)} · {SOURCE_LABEL[refund.source]}
          </p>
          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          {formatDateTime(refund.createdAt)}
        </p>
        {refund.failureReason && (
          <p className="line-clamp-1 text-sm text-[var(--color-text-secondary)]">
            {refund.failureReason}
          </p>
        )}
      </Link>
    </li>
  );
}
