"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ghostButton } from "@/components/profile/styles";
import {
  AdminPage,
  DetailList,
  QueryState,
  Section,
} from "@/components/admin/admin-ui";
import {
  CaseActions,
  CaseStatusPill,
  DetailsSection,
  OutcomeSection,
  PartySection,
} from "@/components/admin/case-parts";
import { formatDateTime } from "@/lib/admin";
import {
  APPLICATION_STATUS_LABEL,
  REPORT_CATEGORY_LABEL,
  ageText,
  isCaseOpen,
  partyName,
  useAdminReport,
  useReportAction,
} from "@/lib/admin-cases";

export function AdminReportDetailPage({ id }: { id: string }) {
  const query = useAdminReport(id);
  const action = useReportAction(id);
  const detail = query.data;

  return (
    <AdminPage
      back={{ href: "/dashboard/admin/reports", label: "Reports" }}
      title={detail ? REPORT_CATEGORY_LABEL[detail.category] : "Report"}
      description={
        detail && (
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <CaseStatusPill status={detail.status} />
            <span>
              Sent {ageText(detail.createdAt)}
              {detail.handledBy
                ? `. Handled by ${detail.handledBy.name ?? "an admin"}.`
                : ". No one has taken it."}
            </span>
          </span>
        )
      }
      actions={
        detail ? (
          <CaseActions
            noun="report"
            status={detail.status}
            handledBy={detail.handledBy}
            mutation={action}
          />
        ) : undefined
      }
    >
      <QueryState
        query={query}
        isEmpty={!detail}
        loadingLabel="Loading report"
        errorText="Couldn't load this report."
        emptyText="This report could not be found."
        skeletonCount={2}
      >
        {detail && (
          <>
            <DetailsSection title="What they wrote" text={detail.details} />

            {!isCaseOpen(detail.status) && (
              <OutcomeSection
                status={detail.status}
                note={detail.resolutionNote}
                handledBy={detail.handledBy}
                resolvedAt={detail.resolvedAt}
              />
            )}

            <PartySection title="Reported by" party={detail.reporter} />
            <PartySection title="Reported" party={detail.target} />

            <Section title={`About ${partyName(detail.target)}`}>
              <DetailList
                items={[
                  { label: "Open reports", value: detail.targetOpenReports },
                  { label: "All reports", value: detail.targetReportCount },
                  {
                    label: "Block",
                    value: detail.targetActiveBlock
                      ? `Blocked ${formatDateTime(detail.targetActiveBlock.blockedAt)}. ${detail.targetActiveBlock.reason}`
                      : "Not blocked",
                  },
                ]}
              />
              <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                Resolving a report doesn&apos;t block anyone. To block or
                unblock, use the account page.
              </p>
            </Section>

            {detail.application && (
              <Section
                title="Tuition"
                actions={
                  <Link
                    href={`/dashboard/applications/${encodeURIComponent(detail.application.id)}?from=admin`}
                    className={cn(ghostButton, "min-h-10")}
                  >
                    Open application
                  </Link>
                }
              >
                <DetailList
                  items={[
                    {
                      label: "Status",
                      value:
                        APPLICATION_STATUS_LABEL[detail.application.status],
                    },
                    {
                      label: "Confirmed",
                      value: formatDateTime(detail.application.confirmedAt),
                    },
                  ]}
                />
              </Section>
            )}
          </>
        )}
      </QueryState>
    </AdminPage>
  );
}
