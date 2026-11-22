"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { card, focusRing } from "@/components/profile/styles";
import { enterClass, enterStyle } from "@/components/motion/enter";
import {
  AdminPage,
  DetailList,
  FilterChips,
  LoadMore,
  QueryState,
  StatusPill,
} from "@/components/admin/admin-ui";
import { formatAmount } from "@/lib/admin";
import { useIntentPrefetch } from "@/lib/prefetch";
import {
  FEE_STATUS_META,
  adminFeeQueryOptions,
  formatDueDate,
  useAdminFees,
  type AdminFee,
  type AdminFeeFilters,
} from "@/lib/admin-fees";

type View = "all" | "overdue" | "due" | "partial" | "paid" | "waived" | "void";

const VIEWS: { value: View; label: string; filters: AdminFeeFilters }[] = [
  { value: "all", label: "All", filters: {} },
  { value: "overdue", label: "Overdue", filters: { overdue: true } },
  { value: "due", label: "Due", filters: { status: "DUE" } },
  { value: "partial", label: "Partly paid", filters: { status: "PARTIAL" } },
  { value: "paid", label: "Paid", filters: { status: "PAID" } },
  { value: "waived", label: "Waived", filters: { status: "WAIVED" } },
  { value: "void", label: "Void", filters: { status: "VOID" } },
];

const VIEW_VALUES = new Set<string>(VIEWS.map((v) => v.value));

export function AdminFeesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("view") ?? "all";
  const view: View = VIEW_VALUES.has(raw) ? (raw as View) : "all";
  const filters = VIEWS.find((v) => v.value === view)?.filters ?? {};
  const query = useAdminFees(filters);
  const fees = query.data?.pages.flatMap((p) => p.fees) ?? [];

  // The view lives in the URL. "all" drops its param so the bare path stays clean.
  function setView(next: View) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("view");
    else params.set("view", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Fees"
      description="Placement fees owed by tutors. Record cash payments here."
    >
      <FilterChips
        label="Fee view"
        value={view}
        options={VIEWS}
        onChange={setView}
      />

      <QueryState
        query={query}
        isEmpty={fees.length === 0}
        loadingLabel="Loading fees"
        errorText="Couldn't load fees."
        emptyText={
          view === "all"
            ? "No fees yet. A fee appears here when an application is confirmed."
            : "No fees in this view."
        }
      >
        <ul className="grid gap-4">
          {fees.map((fee, index) => (
            <li key={fee.id} className={enterClass} style={enterStyle(index)}>
              <FeeRow fee={fee} />
            </li>
          ))}
        </ul>
        <LoadMore query={query} />
      </QueryState>
    </AdminPage>
  );
}

function FeeRow({ fee }: { fee: AdminFee }) {
  const meta = FEE_STATUS_META[fee.status];
  const intent = useIntentPrefetch();
  return (
    <Link
      href={`/dashboard/admin/fees/${encodeURIComponent(fee.id)}`}
      {...intent(adminFeeQueryOptions(fee.id))}
      className={cn(card, "grid gap-4 p-5", focusRing)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
            {fee.tutor.name} → {fee.student.name}
          </p>
          <p className="mt-1 text-sm break-words text-[var(--color-text-secondary)]">
            {fee.application.packageTitle ?? "Requirement"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
          {fee.overdue && <StatusPill tone="error">Overdue</StatusPill>}
          {fee.unpaid && <StatusPill tone="warning">Unpaid</StatusPill>}
        </div>
      </div>
      <DetailList
        items={[
          { label: "Amount due", value: formatAmount(fee.amountDue) },
          { label: "Paid", value: formatAmount(fee.amountPaid) },
          { label: "Remaining", value: formatAmount(fee.remaining) },
          { label: "Due date", value: formatDueDate(fee.dueDate) },
        ]}
      />
    </Link>
  );
}
