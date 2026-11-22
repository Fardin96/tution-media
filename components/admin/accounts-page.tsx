"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { card, focusRing } from "@/components/profile/styles";
import { enterClass, enterStyle } from "@/components/motion/enter";
import {
  AdminPage,
  Field,
  FilterChips,
  LoadMore,
  PendingButton,
  QueryState,
  StatusPill,
  inputClass,
  type PillTone,
} from "@/components/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/admin";
import {
  useAdminAccounts,
  type AccountRole,
  type AccountStatus,
  type AdminAccountSummary,
} from "@/lib/admin-accounts";

const PATH = "/dashboard/admin/accounts";
const ROLES: AccountRole[] = ["STUDENT", "TUTOR", "ADMIN"];
const STATUSES: AccountStatus[] = ["ACTIVE", "BLOCKED", "DELETED"];

type RoleFilter = "ALL" | AccountRole;
type StatusFilter = "ALL" | AccountStatus;

const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "STUDENT", label: "Students" },
  { value: "TUTOR", label: "Tutors" },
  { value: "ADMIN", label: "Admins" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Any status" },
  { value: "ACTIVE", label: "Active" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "DELETED", label: "Deleted" },
];

const ROLE_LABEL: Record<AccountRole, string> = {
  STUDENT: "Student",
  TUTOR: "Tutor",
  ADMIN: "Admin",
};

const STATUS_PILL: Record<AccountStatus, { tone: PillTone; label: string }> = {
  ACTIVE: { tone: "success", label: "Active" },
  BLOCKED: { tone: "error", label: "Blocked" },
  DELETED: { tone: "neutral", label: "Deleted" },
};

function parseRole(value: string | null): RoleFilter {
  return ROLES.find((role) => role === value) ?? "ALL";
}

function parseStatus(value: string | null): StatusFilter {
  return STATUSES.find((status) => status === value) ?? "ALL";
}

export function AccountsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const role = parseRole(searchParams.get("role"));
  const status = parseStatus(searchParams.get("status"));

  const accounts = useAdminAccounts({
    q: q || undefined,
    role: role === "ALL" ? undefined : role,
    status: status === "ALL" ? undefined : status,
  });
  const rows = accounts.data?.pages.flatMap((page) => page.accounts) ?? [];
  const filtered = q !== "" || role !== "ALL" || status !== "ALL";

  /** Writes the filters to the URL. Empty values are left out, so a cleared search drops `q`. */
  function update(next: {
    q?: string;
    role?: RoleFilter;
    status?: StatusFilter;
  }) {
    const params = new URLSearchParams();
    const nextQ = next.q ?? q;
    const nextRole = next.role ?? role;
    const nextStatus = next.status ?? status;
    if (nextQ) params.set("q", nextQ);
    if (nextRole !== "ALL") params.set("role", nextRole);
    if (nextStatus !== "ALL") params.set("status", nextStatus);
    const query = params.toString();
    router.replace(query ? `${PATH}?${query}` : PATH, { scroll: false });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Accounts"
      description="Search by name, email or phone number."
    >
      <div className="grid gap-3">
        {/* Keyed on the saved query so the draft resets when the URL changes. */}
        <SearchForm
          key={q}
          initialQuery={q}
          searching={accounts.isFetching && !accounts.isFetchingNextPage}
          onSearch={(value) => update({ q: value })}
        />
        <FilterChips
          label="Role"
          value={role}
          options={ROLE_OPTIONS}
          onChange={(value) => update({ role: value })}
        />
        <FilterChips
          label="Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => update({ status: value })}
        />
      </div>

      <QueryState
        query={accounts}
        isEmpty={rows.length === 0}
        loadingLabel="Loading accounts"
        errorText="Couldn't load accounts."
        emptyText={
          filtered ? "No accounts match these filters." : "No accounts yet."
        }
      >
        <ul className="grid gap-3">
          {rows.map((account, index) => (
            <li
              key={account.id}
              className={enterClass}
              style={enterStyle(index)}
            >
              <AccountRow account={account} />
            </li>
          ))}
        </ul>
        <LoadMore query={accounts} />
      </QueryState>
    </AdminPage>
  );
}

function SearchForm({
  initialQuery,
  searching,
  onSearch,
}: {
  initialQuery: string;
  /** The list is refetching for the saved query; the button waits for it. */
  searching: boolean;
  onSearch: (value: string) => void;
}) {
  const [draft, setDraft] = useState(initialQuery);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searching) return;
    onSearch(draft.trim());
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="min-w-0 flex-1 basis-64">
        <Field label="Search">
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              placeholder="Name, email or phone number"
              autoComplete="off"
              className={inputClass}
            />
          )}
        </Field>
      </div>
      <PendingButton pending={searching}>Search</PendingButton>
    </form>
  );
}

function AccountRow({ account }: { account: AdminAccountSummary }) {
  const pill = STATUS_PILL[account.status];
  return (
    <Link
      href={`${PATH}/${account.id}`}
      className={cn(
        card,
        focusRing,
        "flex flex-wrap items-start justify-between gap-3 p-5 transition-[box-shadow,scale] duration-150 ease-out active:scale-[0.99] motion-reduce:transition-none",
        "hover:shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.04),0_16px_36px_-12px_rgb(0_0_0/0.12)]",
      )}
    >
      <div className="min-w-0 flex-1 basis-56">
        <p className="font-semibold break-words text-[var(--color-neutral-charcoal)]">
          {account.name ?? "No profile yet"}
        </p>
        <p className="mt-1 text-sm break-words text-[var(--color-text-secondary)]">
          {account.email}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm break-words text-[var(--color-text-secondary)] tabular-nums">
          <span>{account.phoneNumber ?? "No phone number"}</span>
          {account.phoneNumber &&
            (account.phoneVerifiedAt ? (
              <Badge variant="secondary">Verified</Badge>
            ) : (
              <Badge variant="outline">Not verified</Badge>
            ))}
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)] tabular-nums">
          {`${ROLE_LABEL[account.role]} · Created ${formatDateTime(account.createdAt)}`}
        </p>
      </div>
      <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
    </Link>
  );
}
