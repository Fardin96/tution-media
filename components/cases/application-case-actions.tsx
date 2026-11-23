"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { card, ghostButton } from "@/components/profile/styles";
import { TonePill } from "@/components/applications/status-pill";
import { DisputeDialog } from "@/components/cases/dispute-dialog";
import { ReportDialog } from "@/components/cases/report-dialog";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import type { ApplicationDetail } from "@/lib/applications";
import {
  CASE_STATUS_META,
  canReportApplication,
  DISPUTE_TYPE_LABEL,
  isCaseActive,
  useMyDisputes,
} from "@/lib/cases";

export function ApplicationCaseActions({
  application,
  viewerRole,
}: {
  application: ApplicationDetail;
  viewerRole: "STUDENT" | "TUTOR";
}) {
  const [reportOpen, setReportOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const canDispute =
    application.status === "CONFIRMED" || application.status === "COMPLETED";
  const canReport = canReportApplication(application.status);
  const disputes = useMyDisputes(application.id, canDispute);
  const active = disputes.data?.pages
    .flatMap((page) => page.disputes)
    .find((dispute) => isCaseActive(dispute.status));
  const otherName =
    viewerRole === "STUDENT"
      ? application.tutor.name
      : application.student.name;

  // No empty "Something wrong?" card when neither action applies.
  if (!canDispute && !canReport) return null;

  return (
    <section
      aria-labelledby="case-actions-heading"
      className={cn(
        card,
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 sm:px-6",
      )}
    >
      <h2
        id="case-actions-heading"
        className="text-sm font-semibold text-[var(--color-text-secondary)]"
      >
        Something wrong?
      </h2>
      <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">
        {canDispute &&
          (active ? (
            <Link
              href="/dashboard/reports"
              className={cn(ghostButton, "min-h-10 max-w-full px-3")}
            >
              <LinkPendingLabel>
                <span className="min-w-0 truncate">
                  Dispute: {DISPUTE_TYPE_LABEL[active.type]}
                </span>
                <TonePill tone={CASE_STATUS_META[active.status].tone}>
                  {CASE_STATUS_META[active.status].label}
                </TonePill>
              </LinkPendingLabel>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setDisputeOpen(true)}
              disabled={disputes.isPending}
              className={cn(ghostButton, "min-h-10 px-3")}
            >
              Open a dispute
            </button>
          ))}
        {canReport && (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className={cn(ghostButton, "min-h-10 max-w-full px-3")}
          >
            <span className="min-w-0 truncate">Report {otherName}</span>
          </button>
        )}
      </div>
      {canDispute && (
        <DisputeDialog
          applicationId={application.id}
          open={disputeOpen}
          onOpenChange={setDisputeOpen}
        />
      )}
      {canReport && (
        <ReportDialog
          applicationId={application.id}
          targetName={otherName}
          open={reportOpen}
          onOpenChange={setReportOpen}
        />
      )}
    </section>
  );
}
