"use client";

import { useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { TonePill } from "@/components/applications/status-pill";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ListingCard,
  listingTitleClass,
  type ListingAccent,
} from "@/components/ui/listing-card";
import type { EducationLookup } from "@/lib/education";
import {
  COVERAGE_LABEL,
  durationLabel,
  packagePlaceText,
  packageLevelText,
  packageState,
  priceLabel,
  useClosePackage,
  type MyPackage,
} from "@/lib/packages";
import { optionName } from "@/lib/profile";
import { useSubjects } from "@/lib/subjects";
import { formatTimeRange } from "@/lib/tutor-requirements";
import { toastError, toastSuccess } from "@/lib/toast";

function requestSummary(pkg: MyPackage): { text: string; waiting: boolean } {
  if (pkg.pendingRequestCount > 0) {
    return { text: `${pkg.pendingRequestCount} waiting`, waiting: true };
  }
  if (pkg.requestCount === 0) {
    return { text: "No requests yet", waiting: false };
  }
  const noun = pkg.requestCount === 1 ? "request" : "requests";
  return { text: `${pkg.requestCount} ${noun}`, waiting: false };
}

function studentsText(max: number): string {
  return max === 1 ? "1 student" : `Up to ${max} students`;
}

export function MyPackageCard({
  pkg,
  lookup,
  accent = "sky",
}: {
  pkg: MyPackage;
  lookup?: EducationLookup;
  accent?: ListingAccent;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const close = useClosePackage();
  const { subjects: subjectOptions } = useSubjects();

  const state = packageState(pkg);
  const requests = requestSummary(pkg);
  const isLive = pkg.status === "OPEN";
  const needsZone = isLive && !pkg.teachesOnline && pkg.zoneCount === 0;
  const subjects = pkg.subjectIds
    .map((id) => optionName(subjectOptions, id))
    .join(", ");

  function confirmClose() {
    setConfirmOpen(false);
    close.mutate(pkg.id, {
      onSuccess: () => toastSuccess("Package closed."),
      onError: (err) => toastError("Couldn't close this package.", err),
    });
  }

  return (
    <>
      <ListingCard
        icon={Package}
        accent={accent}
        status={<TonePill tone={state.tone}>{state.label}</TonePill>}
        title={<h3 className={listingTitleClass}>{pkg.title}</h3>}
        body={<p className="line-clamp-3">{pkg.description}</p>}
        details={
          <>
            {pkg.moderationStatus === "REJECTED" && pkg.moderationNote && (
              <p className="font-medium text-[var(--color-semantic-error-text)]">
                {`Admin note: ${pkg.moderationNote}`}
              </p>
            )}
            {isLive && pkg.moderationStatus === "PENDING" && (
              <p>Students can&apos;t see it until an admin approves it.</p>
            )}
            <p>{`${COVERAGE_LABEL[pkg.coverage]} · ${durationLabel(pkg.durationWeeks)}`}</p>
            <p>{packageLevelText(lookup, pkg)}</p>
            <p>{subjects}</p>
            <p>
              {`${packagePlaceText(pkg)} · ${formatTimeRange(pkg.timeFrom, pkg.timeTo)}`}
            </p>
            {needsZone && (
              <p className="font-medium text-[var(--color-semantic-warning-text)]">
                Add a zone or turn on online teaching so students can find it.
              </p>
            )}
          </>
        }
        meta={studentsText(pkg.maxStudents)}
        figure={
          <>
            {priceLabel(pkg.price)}
            <span className="font-normal text-[var(--color-text-secondary)]">
              {" total"}
            </span>
          </>
        }
        actions={
          <>
            <p
              className={cn(
                "me-auto self-center text-sm tabular-nums",
                requests.waiting
                  ? "font-semibold text-[var(--color-neutral-charcoal)]"
                  : "text-[var(--color-text-secondary)]",
              )}
            >
              {requests.text}
            </p>
            <Link
              href={`/dashboard/tutor/packages/${pkg.id}/requests`}
              className={cn(
                requests.waiting ? primaryButton : secondaryButton,
                "min-h-10 px-4",
              )}
            >
              View requests
            </Link>
            {isLive && (
              <>
                <Link
                  href={`/dashboard/tutor/packages/${pkg.id}/edit`}
                  className={cn(secondaryButton, "min-h-10 px-4")}
                >
                  Edit
                </Link>
                <button
                  type="button"
                  disabled={close.isPending}
                  onClick={() => setConfirmOpen(true)}
                  className={cn(ghostButton, "min-h-10 px-4")}
                >
                  Close
                </button>
              </>
            )}
          </>
        }
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Close this package?"
        actions={[
          {
            label: "Cancel",
            variant: "secondary",
            onSelect: () => setConfirmOpen(false),
          },
          {
            label: "Close package",
            variant: "primary",
            onSelect: confirmClose,
          },
        ]}
      >
        <p>
          Students can no longer request it. Requests still waiting are expired
          and those students are told. A confirmed tuition is not affected.
        </p>
      </ConfirmDialog>
    </>
  );
}
