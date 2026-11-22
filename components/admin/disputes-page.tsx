"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AdminPage,
  FilterChips,
  LoadMore,
  QueryState,
} from "@/components/admin/admin-ui";
import {
  CaseLink,
  CaseStatusPill,
  Parties,
} from "@/components/admin/case-parts";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { formatDateTime } from "@/lib/admin";
import { useIntentPrefetch } from "@/lib/prefetch";
import {
  DISPUTE_TYPE_LABEL,
  adminDisputeQueryOptions,
  ageText,
  partyName,
  useAdminDisputes,
  type AdminDispute,
  type CaseQueue,
  type DisputeType,
} from "@/lib/admin-cases";

const QUEUES: { value: CaseQueue; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

type TypeView = DisputeType | "all";

const TYPES: { value: TypeView; label: string }[] = [
  { value: "all", label: "Any type" },
  ...(Object.keys(DISPUTE_TYPE_LABEL) as DisputeType[]).map((value) => ({
    value,
    label: DISPUTE_TYPE_LABEL[value],
  })),
];

const TYPE_VALUES = new Set<string>(Object.keys(DISPUTE_TYPE_LABEL));

export function AdminDisputesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const queue: CaseQueue =
    searchParams.get("queue") === "closed" ? "closed" : "open";
  const rawType = searchParams.get("type") ?? "";
  const type: TypeView = TYPE_VALUES.has(rawType)
    ? (rawType as DisputeType)
    : "all";

  const query = useAdminDisputes({
    queue,
    type: type === "all" ? undefined : type,
  });
  const disputes = query.data?.pages.flatMap((p) => p.disputes) ?? [];

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
      title="Disputes"
      description="Problems with a tuition that someone wants an admin to step in on. Open shows the oldest first. Closed shows the latest."
    >
      <div className="grid gap-3">
        <FilterChips
          label="Dispute queue"
          value={queue}
          options={QUEUES}
          onChange={(next) => setParam("queue", next === "open" ? null : next)}
        />
        <FilterChips
          label="Dispute type"
          value={type}
          options={TYPES}
          onChange={(next) => setParam("type", next === "all" ? null : next)}
        />
      </div>

      <QueryState
        query={query}
        isEmpty={disputes.length === 0}
        loadingLabel="Loading disputes"
        errorText="Couldn't load disputes."
        emptyText={
          queue === "open" ? "No open disputes." : "No closed disputes yet."
        }
      >
        <ul className="grid gap-4">
          {disputes.map((dispute, index) => (
            <li
              key={dispute.id}
              className={enterClass}
              style={enterStyle(index)}
            >
              <DisputeRow dispute={dispute} />
            </li>
          ))}
        </ul>
        <LoadMore query={query} />
      </QueryState>
    </AdminPage>
  );
}

function DisputeRow({ dispute }: { dispute: AdminDispute }) {
  const intent = useIntentPrefetch();
  return (
    <CaseLink
      href={`/dashboard/admin/disputes/${encodeURIComponent(dispute.id)}`}
      {...intent(adminDisputeQueryOptions(dispute.id))}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 font-semibold break-words text-[var(--color-neutral-charcoal)]">
          {DISPUTE_TYPE_LABEL[dispute.type]}
        </p>
        <CaseStatusPill status={dispute.status} />
      </div>
      <p className="text-sm text-[var(--color-neutral-charcoal)]">
        <Parties
          from={partyName(dispute.raisedBy)}
          to={partyName(dispute.against)}
          word="against"
        />
      </p>
      <p className="line-clamp-2 text-sm break-words text-[var(--color-text-secondary)]">
        {dispute.details}
      </p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
        <time
          dateTime={dispute.createdAt}
          title={formatDateTime(dispute.createdAt)}
        >
          {ageText(dispute.createdAt)}
        </time>
        <span>
          {dispute.handledBy
            ? `Handled by ${dispute.handledBy.name ?? "an admin"}`
            : "No one has taken it"}
        </span>
      </p>
    </CaseLink>
  );
}
