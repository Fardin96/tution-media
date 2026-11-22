"use client";

import { useId, useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog as DialogPrimitive } from "radix-ui";
import { toast } from "sonner";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldError, control } from "@/components/profile/profile-fields";
import {
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { Skeleton } from "@/components/ui/skeleton";
import SpinnerEllipsis from "@/components/shadcn-space/spinner/spinner-05";
import { toastError, toastSuccess } from "@/lib/toast";
import { isRateLimit } from "@/lib/api-errors";
import { queryKeys, type ZoneRequestStatus } from "@/lib/query-keys";
import {
  REASON_MAX,
  REASON_MIN,
  ZONE_LIMIT_MAX,
  tutorZoneApi,
  useZoneLimitRequests,
  type ZoneLimitRequest,
} from "@/lib/tutor-zones";

export interface ZoneLimitRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLimit: number;
  pendingRequest: ZoneLimitRequest | null;
}

const STATUS_LABEL: Record<ZoneRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  DENIED: "Denied",
};

const STATUS_CLASS: Record<ZoneRequestStatus, string> = {
  PENDING: "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]",
  APPROVED:
    "bg-[var(--color-semantic-success-surface)] text-[var(--color-semantic-success-text)]",
  DENIED:
    "bg-[var(--color-semantic-error-surface)] text-[var(--color-semantic-error-text)]",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatRequestDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

/** The starting number: five more zones, never above the server maximum. */
export function defaultRequestedLimit(currentLimit: number): number {
  return Math.min(currentLimit + 5, ZONE_LIMIT_MAX);
}

export interface ZoneLimitRequestErrors {
  requestedLimit?: string;
  reason?: string;
}

export function validateZoneLimitRequest(
  limitText: string,
  reason: string,
  currentLimit: number,
): ZoneLimitRequestErrors {
  const errors: ZoneLimitRequestErrors = {};
  const limit = Number(limitText);
  if (limitText.trim() === "") {
    errors.requestedLimit = "Enter how many zones you need.";
  } else if (!Number.isInteger(limit)) {
    errors.requestedLimit = "Use a whole number.";
  } else if (limit <= currentLimit) {
    errors.requestedLimit = `Pick a number above your current limit of ${currentLimit}.`;
  } else if (limit > ZONE_LIMIT_MAX) {
    errors.requestedLimit = `The most zones you can have is ${ZONE_LIMIT_MAX}.`;
  }

  const length = reason.trim().length;
  if (length < REASON_MIN) {
    errors.reason = `Explain why you need more zones. Use at least ${REASON_MIN} characters.`;
  } else if (length > REASON_MAX) {
    errors.reason = `Keep the reason under ${REASON_MAX} characters.`;
  }
  return errors;
}

export function ZoneLimitRequestDialog({
  open,
  onOpenChange,
  currentLimit,
  pendingRequest,
}: ZoneLimitRequestDialogProps) {
  const history = useZoneLimitRequests(open);
  const requests = history.data?.pages.flatMap((page) => page.requests) ?? [];
  const atMax = currentLimit >= ZONE_LIMIT_MAX;

  let description: string;
  if (pendingRequest) {
    description = "Your last request is still waiting for a decision.";
  } else if (atMax) {
    description = `You already have the ${ZONE_LIMIT_MAX}-zone maximum.`;
  } else {
    description = `You can have up to ${ZONE_LIMIT_MAX} zones. Your limit is ${currentLimit} right now.`;
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogPrimitive.Title className="text-lg font-semibold text-[var(--color-neutral-charcoal)]">
                Request more zones
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
                {description}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close"
              className={cn(
                ghostButton,
                "size-11 shrink-0 px-0 text-[var(--color-neutral-charcoal)]",
              )}
            >
              <X aria-hidden="true" className="size-5" />
            </DialogPrimitive.Close>
          </div>

          {pendingRequest ? (
            <PendingNotice request={pendingRequest} />
          ) : atMax ? null : (
            <RequestForm
              currentLimit={currentLimit}
              onDone={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          )}

          <RequestHistory
            requests={requests}
            isPending={history.isPending}
            isError={history.isError}
            hasNextPage={history.hasNextPage}
            isFetchingNextPage={history.isFetchingNextPage}
            onRetry={() => void history.refetch()}
            onShowMore={() => void history.fetchNextPage()}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PendingNotice({ request }: { request: ZoneLimitRequest }) {
  return (
    <div className="mt-6 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4">
      <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)]">
        Request for {request.requestedLimit} zones is pending
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Sent {formatRequestDate(request.createdAt)}. You can send another
        request after this one is decided.
      </p>
    </div>
  );
}

function RequestForm({
  currentLimit,
  onDone,
  onCancel,
}: {
  currentLimit: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const queryClient = useQueryClient();
  const limitId = useId();
  const reasonId = useId();
  const limitErrorId = `${limitId}-error`;
  const reasonErrorId = `${reasonId}-error`;
  const countId = `${reasonId}-count`;
  const hintId = `${reasonId}-hint`;

  const [limitText, setLimitText] = useState(() =>
    String(defaultRequestedLimit(currentLimit)),
  );
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const errors = validateZoneLimitRequest(limitText, reason, currentLimit);
  const shown = submitted ? errors : {};

  const mutation = useMutation({
    mutationFn: (body: { requestedLimit: number; reason: string }) =>
      tutorZoneApi.requestMore(body),
    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.tutor.zones }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.tutor.zoneRequests,
        }),
      ]);
      toastSuccess("Request sent");
      onDone();
    },
    onError: (err) => {
      // The server's daily-limit message is more useful than a generic line.
      if (isRateLimit(err) && err instanceof Error) {
        toast.error(err.message);
        return;
      }
      toastError("Couldn't send the request. Try again.", err);
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;
    mutation.mutate({
      requestedLimit: Number(limitText),
      reason: reason.trim(),
    });
  }

  const count = reason.trim().length;

  return (
    <form noValidate onSubmit={onSubmit} className="mt-6 grid gap-5">
      <div className="grid gap-2">
        <label
          htmlFor={limitId}
          className="text-sm font-medium text-[var(--color-neutral-charcoal)]"
        >
          How many zones do you need?
        </label>
        <input
          id={limitId}
          type="number"
          inputMode="numeric"
          step={1}
          min={currentLimit + 1}
          max={ZONE_LIMIT_MAX}
          value={limitText}
          onChange={(e) => setLimitText(e.target.value)}
          aria-invalid={shown.requestedLimit ? true : undefined}
          aria-describedby={shown.requestedLimit ? limitErrorId : undefined}
          className={cn(control, "h-12")}
        />
        <FieldError id={limitErrorId} message={shown.requestedLimit} />
      </div>

      <div className="grid gap-2">
        <label
          htmlFor={reasonId}
          className="text-sm font-medium text-[var(--color-neutral-charcoal)]"
        >
          Why do you need them?
        </label>
        <p id={hintId} className="text-sm text-[var(--color-text-secondary)]">
          Name the areas you cover and why your current zones are not enough.
        </p>
        <textarea
          id={reasonId}
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={shown.reason ? true : undefined}
          aria-describedby={[hintId, countId, shown.reason && reasonErrorId]
            .filter(Boolean)
            .join(" ")}
          className={cn(control, "min-h-28 resize-y py-3 leading-relaxed")}
        />
        <div className="flex items-start justify-between gap-4">
          <FieldError id={reasonErrorId} message={shown.reason} />
          <p
            id={countId}
            className={cn(
              "ms-auto text-xs text-[var(--color-text-secondary)] tabular-nums",
              count > REASON_MAX && "text-[var(--color-semantic-error-text)]",
            )}
          >
            {count}/{REASON_MAX}
          </p>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className={cn(secondaryButton, "min-h-11 sm:min-w-28")}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={mutation.isPending}
          aria-busy={mutation.isPending || undefined}
          className={cn(primaryButton, "min-h-11 sm:min-w-36")}
        >
          Send request
          {mutation.isPending && <SpinnerEllipsis />}
        </button>
      </div>
    </form>
  );
}

function RequestHistory({
  requests,
  isPending,
  isError,
  hasNextPage,
  isFetchingNextPage,
  onRetry,
  onShowMore,
}: {
  requests: ZoneLimitRequest[];
  isPending: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onRetry: () => void;
  onShowMore: () => void;
}) {
  return (
    <section
      aria-labelledby="zone-request-history-title"
      className="mt-8 border-t border-[var(--color-neutral-border)] pt-5"
    >
      <h3
        id="zone-request-history-title"
        className="text-sm font-semibold text-[var(--color-neutral-charcoal)]"
      >
        Your requests
      </h3>

      {isPending ? (
        <div role="status" className="mt-3 grid gap-3">
          <span className="sr-only">Loading your requests…</span>
          {[0, 1].map((i) => (
            <div
              key={i}
              aria-hidden="true"
              className="grid gap-2 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--color-text-secondary)]">
          <span>Couldn&apos;t load your requests.</span>
          <button
            type="button"
            onClick={onRetry}
            className={cn(ghostButton, "min-h-11 px-3")}
          >
            Try again
          </button>
        </div>
      ) : requests.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          No requests yet.
        </p>
      ) : (
        <>
          <ul className="mt-3 grid gap-3">
            {requests.map((request) => (
              <li
                key={request.id}
                className="rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--color-neutral-charcoal)]">
                    {request.requestedLimit} zones
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                      STATUS_CLASS[request.status],
                    )}
                  >
                    {STATUS_LABEL[request.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)] tabular-nums">
                  Sent {formatRequestDate(request.createdAt)}
                  {request.decidedAt &&
                    ` · Decided ${formatRequestDate(request.decidedAt)}`}
                </p>
                {request.decisionNote && (
                  <p className="mt-2 text-sm text-pretty text-[var(--color-neutral-charcoal)]">
                    {request.decisionNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {hasNextPage && (
            <button
              type="button"
              onClick={onShowMore}
              disabled={isFetchingNextPage}
              aria-busy={isFetchingNextPage || undefined}
              className={cn(ghostButton, "mt-3 min-h-11 px-3")}
            >
              Show more
              {isFetchingNextPage && <SpinnerEllipsis />}
            </button>
          )}
        </>
      )}
    </section>
  );
}
