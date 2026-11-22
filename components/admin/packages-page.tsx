"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ghostButton,
  primaryButton,
  secondaryButton,
  card,
} from "@/components/profile/styles";
import {
  AdminDialog,
  AdminPage,
  DialogActions,
  Field,
  LoadMore,
  QueryState,
  StatusPill,
  textareaClass,
} from "@/components/admin/admin-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { useIntentPrefetch } from "@/lib/prefetch";
import { formatAmount, formatDateTime } from "@/lib/admin";
import {
  adminPackageQueryOptions,
  useAdminPackages,
  useModeratePackage,
  validateRejectNote,
  type AdminPackage,
  type ModeratePackageInput,
  type PackageModerationStatus,
} from "@/lib/admin-packages";
import { useEducationLookup } from "@/lib/education";
import {
  durationLabel,
  packageLevelText,
  packagePlaceText,
} from "@/lib/packages";
import { toastError, toastSuccess } from "@/lib/toast";

const QUEUE_PATH = "/dashboard/admin/packages";

const TABS: {
  value: string;
  status: PackageModerationStatus;
  label: string;
}[] = [
  { value: "pending", status: "PENDING", label: "Waiting for review" },
  { value: "approved", status: "APPROVED", label: "Approved" },
  { value: "rejected", status: "REJECTED", label: "Rejected" },
];

const EMPTY_COPY: Record<PackageModerationStatus, string> = {
  PENDING: "Nothing waiting. New packages show up here.",
  APPROVED: "No approved packages yet.",
  REJECTED: "No rejected packages.",
};

export const VERIFICATION_LABEL: Record<
  AdminPackage["tutor"]["verificationStatus"],
  string
> = {
  NOT_SUBMITTED: "Verification not submitted",
  PENDING: "Verification pending",
  APPROVED: "Verified",
  REJECTED: "Verification rejected",
};

function statusFromParam(value: string | null): PackageModerationStatus {
  const match = TABS.find((tab) => tab.value === value);
  return match ? match.status : "PENDING";
}

function subjectsText(count: number): string {
  return count === 1 ? "1 subject" : `${count} subjects`;
}

/* ───────── Review state and dialogs (shared with the detail page) ───────── */

export type PackageReviewTarget = {
  id: string;
  action: "APPROVE" | "REJECT";
};

/**
 * Approve or reject one package. The dialog stays mounted through its close animation,
 * so `target` keeps its last value and only `open` goes false.
 */
export function usePackageReview() {
  const [target, setTarget] = useState<PackageReviewTarget | null>(null);
  const [open, setOpen] = useState(false);
  const moderate = useModeratePackage();

  function start(pkg: { id: string }, action: "APPROVE" | "REJECT") {
    setTarget({ id: pkg.id, action });
    setOpen(true);
  }

  function close() {
    if (!moderate.isPending) setOpen(false);
  }

  function confirm(note?: string) {
    if (!target) return;
    const body: ModeratePackageInput =
      target.action === "APPROVE"
        ? { decision: "APPROVE" }
        : { decision: "REJECT", note };
    moderate.mutate(
      { id: target.id, body },
      {
        onSuccess: () => {
          toastSuccess(
            target.action === "APPROVE"
              ? "Package approved"
              : "Package rejected",
          );
          setOpen(false);
        },
        onError: (err) => {
          toastError("Couldn't save the review.", err);
        },
      },
    );
  }

  return {
    target,
    open,
    start,
    close,
    confirm,
    saving: moderate.isPending,
  };
}

export type PackageReviewState = ReturnType<typeof usePackageReview>;

export function ReviewDialog({ review }: { review: PackageReviewState }) {
  const approve = review.target?.action !== "REJECT";
  return (
    <AdminDialog
      open={review.open}
      onOpenChange={(next) => {
        if (!next) review.close();
      }}
      busy={review.saving}
      title={approve ? "Approve this package?" : "Reject this package?"}
      description={
        approve
          ? "Students can find and request this package right away."
          : "The tutor sees your note and can edit the package to send it back for review."
      }
    >
      {approve ? (
        <DialogActions>
          <button
            type="button"
            onClick={review.close}
            disabled={review.saving}
            className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => review.confirm()}
            disabled={review.saving}
            aria-busy={review.saving || undefined}
            className={cn(primaryButton, "min-h-11 sm:min-w-28")}
          >
            <PendingLabel pending={review.saving}>Approve</PendingLabel>
          </button>
        </DialogActions>
      ) : (
        <RejectForm
          key={review.target?.id}
          saving={review.saving}
          onCancel={review.close}
          onSubmit={(note) => review.confirm(note)}
        />
      )}
    </AdminDialog>
  );
}

function RejectForm({
  saving,
  onCancel,
  onSubmit,
}: {
  saving: boolean;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const noteError = validateRejectNote(note);
  const shownError = submitted ? noteError : undefined;

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (noteError) return;
    onSubmit(note.trim());
  }

  return (
    <form noValidate onSubmit={onFormSubmit}>
      <Field label="What should they change?" error={shownError}>
        {({ id, describedBy, invalid }) => (
          <textarea
            id={id}
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={textareaClass}
          />
        )}
      </Field>
      <DialogActions>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          aria-busy={saving || undefined}
          className={cn(
            secondaryButton,
            "min-h-11 text-[var(--color-semantic-error-text)] sm:min-w-28",
          )}
        >
          <PendingLabel pending={saving}>Reject</PendingLabel>
        </button>
      </DialogActions>
    </form>
  );
}

/* ───────── Page ───────── */

export function AdminPackagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lookup = useEducationLookup();

  const status = statusFromParam(searchParams.get("status"));
  const tabValue =
    TABS.find((tab) => tab.status === status)?.value ?? "pending";
  const queue = useAdminPackages(status);
  const review = usePackageReview();

  const packages = queue.data?.pages.flatMap((page) => page.packages) ?? [];

  function onTabChange(value: string) {
    router.replace(
      value === "pending" ? QUEUE_PATH : `${QUEUE_PATH}?status=${value}`,
      { scroll: false },
    );
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Packages"
      description="New packages stay hidden from students until you approve them."
    >
      <Tabs value={tabValue} onValueChange={onTabChange}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="min-h-11 px-4"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tabValue} className="mt-4">
          <QueryState
            query={queue}
            isEmpty={packages.length === 0}
            loadingLabel="Loading packages"
            errorText="Couldn't load these packages."
            emptyText={EMPTY_COPY[status]}
          >
            <ul className="grid gap-4">
              {packages.map((pkg, index) => (
                <li
                  key={pkg.id}
                  className={cn(card, "grid gap-4 p-5", enterClass)}
                  style={enterStyle(index)}
                >
                  <PackageSummary
                    pkg={pkg}
                    levelText={packageLevelText(lookup.data, pkg)}
                    onApprove={() => review.start(pkg, "APPROVE")}
                    onReject={() => review.start(pkg, "REJECT")}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <LoadMore query={queue} />
            </div>
          </QueryState>
        </TabsContent>
      </Tabs>

      <ReviewDialog review={review} />
    </AdminPage>
  );
}

function PackageSummary({
  pkg,
  levelText,
  onApprove,
  onReject,
}: {
  pkg: AdminPackage;
  levelText: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const pending = pkg.moderationStatus === "PENDING";
  const rejected = pkg.moderationStatus === "REJECTED";
  const intent = useIntentPrefetch();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-balance break-words text-[var(--color-neutral-charcoal)]">
            {pkg.title}
          </h2>
          <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
            {pkg.tutor.name} ·{" "}
            {VERIFICATION_LABEL[pkg.tutor.verificationStatus]}
          </p>
        </div>
        {!pkg.tutor.isListed && (
          <StatusPill tone="warning">Not listed</StatusPill>
        )}
      </div>

      <div className="grid gap-1 text-sm text-[var(--color-neutral-charcoal)]">
        <p className="tabular-nums">
          <span className="font-semibold">{formatAmount(pkg.price)}</span>{" "}
          <span className="text-[var(--color-text-secondary)]">total</span>
          {` · ${durationLabel(pkg.durationWeeks)}`}
        </p>
        <p>{levelText}</p>
        <p className="text-[var(--color-text-secondary)]">
          {`${packagePlaceText(pkg)} · ${subjectsText(pkg.subjectIds.length)}`}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          Submitted {formatDateTime(pkg.createdAt)}
        </p>
      </div>

      {rejected && pkg.moderationNote && (
        <div className="grid gap-1 border-t border-[var(--color-neutral-border)] pt-3">
          <p className="text-xs text-[var(--color-text-secondary)]">
            Note for the tutor
          </p>
          <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
            {pkg.moderationNote}
          </p>
        </div>
      )}

      {pending && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`${QUEUE_PATH}/${pkg.id}`}
            {...intent(adminPackageQueryOptions(pkg.id))}
            className={cn(ghostButton, "min-h-11")}
          >
            <LinkPendingLabel>Review</LinkPendingLabel>
          </Link>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onReject}
              className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onApprove}
              className={cn(primaryButton, "min-h-11 sm:min-w-28")}
            >
              Approve
            </button>
          </div>
        </div>
      )}
    </>
  );
}
