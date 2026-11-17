"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldError, control } from "@/components/profile/profile-fields";
import {
  card,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { AdminPage } from "@/components/admin/admin-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRequestDate } from "@/components/tutor-zones/zone-limit-request-dialog";
import { toastError, toastSuccess } from "@/lib/toast";
import { queryKeys, type ZoneRequestStatus } from "@/lib/query-keys";
import {
  REASON_MAX,
  adminZoneRequestApi,
  useAdminZoneRequests,
  type AdminZoneRequest,
} from "@/lib/tutor-zones";

const QUEUE_PATH = "/dashboard/admin/zone-requests";
/** Lowest limit an admin may approve; the server's maximum is ZONE_LIMIT_MAX. */
const APPROVE_MIN = 6;
const APPROVE_MAX = 50;

const TABS: { value: string; status: ZoneRequestStatus; label: string }[] = [
  { value: "pending", status: "PENDING", label: "Pending" },
  { value: "approved", status: "APPROVED", label: "Approved" },
  { value: "denied", status: "DENIED", label: "Denied" },
];

const EMPTY_COPY: Record<ZoneRequestStatus, string> = {
  PENDING: "No pending requests. New requests show up here.",
  APPROVED: "No approved requests yet.",
  DENIED: "No denied requests yet.",
};

const STATUS_CLASS: Record<ZoneRequestStatus, string> = {
  PENDING: "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]",
  APPROVED:
    "bg-[var(--color-semantic-success-surface)] text-[var(--color-semantic-success-text)]",
  DENIED:
    "bg-[var(--color-semantic-error-surface)] text-[var(--color-semantic-error-text)]",
};

const STATUS_LABEL: Record<ZoneRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DENIED: "Denied",
};

type Decision = { request: AdminZoneRequest; action: "APPROVE" | "DENY" };

function statusFromParam(value: string | null): ZoneRequestStatus {
  const match = TABS.find((tab) => tab.value === value);
  return match ? match.status : "PENDING";
}

export function validateApprovedLimit(text: string): string | undefined {
  const limit = Number(text);
  if (text.trim() === "" || !Number.isInteger(limit))
    return "Enter a whole number of zones.";
  if (limit < APPROVE_MIN) return `Approve at least ${APPROVE_MIN} zones.`;
  if (limit > APPROVE_MAX) return `The most is ${APPROVE_MAX} zones.`;
  return undefined;
}

export function ZoneRequestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const param = searchParams.get("status");
  const status = statusFromParam(param);
  const tabValue =
    TABS.find((tab) => tab.status === status)?.value ?? "pending";
  const queue = useAdminZoneRequests(status);
  const [decision, setDecision] = useState<Decision | null>(null);

  const decide = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Parameters<typeof adminZoneRequestApi.decide>[1];
    }) => adminZoneRequestApi.decide(id, body),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.admin.zoneRequestsAll,
      });
      toastSuccess(
        variables.body.decision === "APPROVE"
          ? "Request approved"
          : "Request denied",
      );
      setDecision(null);
    },
    onError: (err) => {
      toastError("Couldn't save the decision.", err);
    },
  });

  const requests = queue.data?.pages.flatMap((page) => page.requests) ?? [];

  function onTabChange(value: string) {
    router.replace(
      value === "pending" ? QUEUE_PATH : `${QUEUE_PATH}?status=${value}`,
      { scroll: false },
    );
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Zone requests"
      description="Tutors ask for more zones here. Approve a request or deny it with a note."
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
          {queue.isPending ? (
            <div role="status" className="grid gap-4">
              <span className="sr-only">Loading requests</span>
              {[0, 1].map((i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className={cn(
                    card,
                    "h-32 animate-pulse p-5 motion-reduce:animate-none",
                  )}
                />
              ))}
            </div>
          ) : queue.isError ? (
            <div
              className={cn(
                card,
                "flex flex-col items-center gap-3 p-6 text-center",
              )}
            >
              <p className="font-semibold text-[var(--color-neutral-charcoal)]">
                Couldn&apos;t load these requests.
              </p>
              <button
                type="button"
                onClick={() => void queue.refetch()}
                className={cn(secondaryButton, "min-h-11")}
              >
                Try again
              </button>
            </div>
          ) : requests.length === 0 ? (
            <div
              className={cn(
                card,
                "p-6 text-center text-sm text-[var(--color-text-secondary)]",
              )}
            >
              {EMPTY_COPY[status]}
            </div>
          ) : (
            <>
              <ul className="grid gap-4">
                {requests.map((request) => (
                  <li key={request.id} className={cn(card, "grid gap-4 p-5")}>
                    <RequestRow
                      request={request}
                      onApprove={() =>
                        setDecision({ request, action: "APPROVE" })
                      }
                      onDeny={() => setDecision({ request, action: "DENY" })}
                    />
                  </li>
                ))}
              </ul>
              {queue.hasNextPage && (
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void queue.fetchNextPage()}
                    disabled={queue.isFetchingNextPage}
                    className={cn(secondaryButton, "min-h-11")}
                  >
                    {queue.isFetchingNextPage ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <DecisionDialog
        decision={decision}
        saving={decide.isPending}
        onOpenChange={(open) => {
          if (!open && !decide.isPending) setDecision(null);
        }}
        onSubmit={(id, body) => decide.mutate({ id, body })}
      />
    </AdminPage>
  );
}

function RequestRow({
  request,
  onApprove,
  onDeny,
}: {
  request: AdminZoneRequest;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const pending = request.status === "PENDING";
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-[var(--color-neutral-charcoal)]">
            {request.tutor.name}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)] tabular-nums">
            Limit {request.tutor.zoneLimit} · {request.tutor.zonesUsed} zones
            used
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
            STATUS_CLASS[request.status],
          )}
        >
          {STATUS_LABEL[request.status]}
        </span>
      </div>

      <div className="grid gap-1">
        <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)]">
          Asks for {request.requestedLimit} zones
        </p>
        <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
          Sent {formatRequestDate(request.createdAt)}
        </p>
      </div>

      <p className="text-sm text-pretty text-[var(--color-neutral-charcoal)]">
        {request.reason}
      </p>

      {!pending && (
        <div className="grid gap-1 border-t border-[var(--color-neutral-border)] pt-3">
          {request.decidedAt && (
            <p className="text-xs text-[var(--color-text-secondary)] tabular-nums">
              Decided {formatRequestDate(request.decidedAt)}
            </p>
          )}
          {request.decisionNote && (
            <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
              {request.decisionNote}
            </p>
          )}
        </div>
      )}

      {pending && (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onDeny}
            className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
          >
            Deny
          </button>
          <button
            type="button"
            onClick={onApprove}
            className={cn(primaryButton, "min-h-11 sm:min-w-28")}
          >
            Approve
          </button>
        </div>
      )}
    </>
  );
}

function DecisionDialog({
  decision,
  saving,
  onOpenChange,
  onSubmit,
}: {
  decision: Decision | null;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    id: string,
    body: Parameters<typeof adminZoneRequestApi.decide>[1],
  ) => void;
}) {
  return (
    <DialogPrimitive.Root open={decision !== null} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/40 duration-150 ease-out",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "motion-reduce:animate-none motion-reduce:transition-none",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed start-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto overscroll-contain rounded-[24px] bg-[var(--color-neutral-white)] p-6 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.08)] focus:outline-none",
            "duration-150 ease-out",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-96",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-96",
            "motion-reduce:animate-none motion-reduce:transition-none",
          )}
        >
          {decision && (
            <DecisionForm
              key={`${decision.action}-${decision.request.id}`}
              decision={decision}
              saving={saving}
              onClose={() => onOpenChange(false)}
              onSubmit={onSubmit}
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DecisionForm({
  decision,
  saving,
  onClose,
  onSubmit,
}: {
  decision: Decision;
  saving: boolean;
  onClose: () => void;
  onSubmit: (
    id: string,
    body: Parameters<typeof adminZoneRequestApi.decide>[1],
  ) => void;
}) {
  const { request, action } = decision;
  const limitId = useId();
  const noteId = useId();
  const limitErrorId = `${limitId}-error`;
  const countId = `${noteId}-count`;

  const [limitText, setLimitText] = useState(() =>
    String(request.requestedLimit),
  );
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const limitError =
    action === "APPROVE" ? validateApprovedLimit(limitText) : undefined;
  const shownLimitError = submitted ? limitError : undefined;
  const approve = action === "APPROVE";

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (approve) {
      if (limitError) return;
      onSubmit(request.id, {
        decision: "APPROVE",
        approvedLimit: Number(limitText),
      });
      return;
    }
    const trimmed = note.trim();
    onSubmit(request.id, {
      decision: "DENY",
      ...(trimmed ? { note: trimmed } : {}),
    });
  }

  return (
    <form noValidate onSubmit={onFormSubmit}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <DialogPrimitive.Title className="text-lg font-semibold text-[var(--color-neutral-charcoal)]">
            {approve ? "Approve zone request?" : "Deny zone request?"}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
            {request.tutor.name} asked for {request.requestedLimit} zones. Their
            limit is {request.tutor.zoneLimit} and they use{" "}
            {request.tutor.zonesUsed}.
          </DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close
          type="button"
          aria-label="Close"
          className={cn(
            ghostButton,
            "size-11 shrink-0 px-0 text-[var(--color-neutral-charcoal)]",
          )}
        >
          <X aria-hidden="true" className="size-5" />
        </DialogPrimitive.Close>
      </div>

      <div className="mt-6 grid gap-5">
        {approve ? (
          <div className="grid gap-2">
            <label
              htmlFor={limitId}
              className="text-sm font-medium text-[var(--color-neutral-charcoal)]"
            >
              Approved limit
            </label>
            <input
              id={limitId}
              type="number"
              inputMode="numeric"
              step={1}
              min={APPROVE_MIN}
              max={APPROVE_MAX}
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
              aria-invalid={shownLimitError ? true : undefined}
              aria-describedby={shownLimitError ? limitErrorId : undefined}
              className={cn(control, "h-12")}
            />
            <FieldError id={limitErrorId} message={shownLimitError} />
          </div>
        ) : (
          <div className="grid gap-2">
            <label
              htmlFor={noteId}
              className="text-sm font-medium text-[var(--color-neutral-charcoal)]"
            >
              Note for the tutor{" "}
              <span className="font-normal text-[var(--color-text-secondary)]">
                (optional)
              </span>
            </label>
            <textarea
              id={noteId}
              rows={3}
              maxLength={REASON_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={countId}
              className={cn(control, "min-h-24 resize-y py-3 leading-relaxed")}
            />
            <p
              id={countId}
              className="ms-auto text-xs text-[var(--color-text-secondary)] tabular-nums"
            >
              {note.length}/{REASON_MAX}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
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
            approve
              ? primaryButton
              : cn(secondaryButton, "text-[var(--color-semantic-error-text)]"),
            "min-h-11 sm:min-w-36",
          )}
        >
          {saving ? "Saving..." : approve ? "Approve request" : "Deny request"}
        </button>
      </div>
    </form>
  );
}
