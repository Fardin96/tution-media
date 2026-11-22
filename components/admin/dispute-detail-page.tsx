"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { ghostButton } from "@/components/profile/styles";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
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
  DISPUTE_TYPE_LABEL,
  ageText,
  isCaseOpen,
  useAdminDispute,
  useDisputeAction,
} from "@/lib/admin-cases";

export function AdminDisputeDetailPage({ id }: { id: string }) {
  const query = useAdminDispute(id);
  const action = useDisputeAction(id);
  const detail = query.data;

  return (
    <AdminPage
      back={{ href: "/dashboard/admin/disputes", label: "Disputes" }}
      title={detail ? `${DISPUTE_TYPE_LABEL[detail.type]} dispute` : "Dispute"}
      description={
        detail && (
          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <CaseStatusPill status={detail.status} />
            <span>
              Opened {ageText(detail.createdAt)}
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
            noun="dispute"
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
        loadingLabel="Loading dispute"
        errorText="Couldn't load this dispute."
        emptyText="This dispute could not be found."
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

            <PartySection title="Raised by" party={detail.raisedBy} />
            <PartySection title="Against" party={detail.against} />

            <Section
              title="Tuition"
              actions={
                <Link
                  href={`/dashboard/applications/${encodeURIComponent(detail.application.id)}?from=admin`}
                  className={cn(ghostButton, "min-h-10")}
                >
                  <LinkPendingLabel>Open application</LinkPendingLabel>
                </Link>
              }
            >
              <DetailList
                items={[
                  {
                    label: "Status",
                    value: APPLICATION_STATUS_LABEL[detail.application.status],
                  },
                  {
                    label: "Confirmed",
                    value: formatDateTime(detail.application.confirmedAt),
                  },
                  {
                    label: "Ended",
                    value: formatDateTime(detail.application.endedAt),
                  },
                  {
                    label: "Other open disputes on it",
                    value: detail.otherOpenDisputes,
                  },
                ]}
              />
              <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                Resolving a dispute doesn&apos;t change the tuition or block
                anyone. Use the application and account pages for that.
              </p>
            </Section>
          </>
        )}
      </QueryState>
    </AdminPage>
  );
}
