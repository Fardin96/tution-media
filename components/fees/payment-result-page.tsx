"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Ban,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  LoaderCircle,
  TriangleAlert,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { BackLink } from "@/components/ui/back-link";
import { PageFrame } from "@/components/ui/page-frame";
import { formatMoney } from "@/components/fees/fee-format";
import {
  isFeeOpen,
  useCheckout,
  usePaymentAttempt,
  type PaymentAttemptView,
} from "@/lib/fees";
import { ApiError } from "@/lib/profile";
import { toastError } from "@/lib/toast";

type Tone = "brand" | "success" | "warning" | "error" | "neutral";

const TONE: Record<Tone, { surface: string; text: string }> = {
  brand: {
    surface: "bg-[var(--color-secondary-sky)]",
    text: "text-[var(--color-primary-core)]",
  },
  success: {
    surface: "bg-[var(--color-semantic-success-surface)]",
    text: "text-[var(--color-semantic-success-text)]",
  },
  warning: {
    surface: "bg-[var(--color-semantic-warning-surface)]",
    text: "text-[var(--color-semantic-warning-text)]",
  },
  error: {
    surface: "bg-[var(--color-semantic-error-surface)]",
    text: "text-[var(--color-semantic-error-text)]",
  },
  neutral: {
    surface: "bg-[var(--color-neutral-off-white)]",
    text: "text-[var(--color-text-secondary)]",
  },
};

/** How long a PENDING payment may take before the page says it is still being checked. */
const LONG_WAIT_MS = 60_000;

/** Counts elapsed seconds while `active`, so the page can add the "still waiting" note after a minute. */
function useElapsedWhile(active: boolean): number {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const id = window.setInterval(
      () => setElapsedMs(Date.now() - startedAt),
      1000,
    );
    return () => {
      window.clearInterval(id);
      setElapsedMs(0);
    };
  }, [active]);
  return elapsedMs;
}

function Reference({ value }: { value: string }) {
  return (
    <span className="font-mono break-all text-[var(--color-neutral-charcoal)] tabular-nums select-all">
      {value}
    </span>
  );
}

/** What the card shows for one attempt state. */
type Outcome = {
  /** Changes with the state, so the status icon cross-fades. */
  key: string;
  tone: Tone;
  icon: LucideIcon;
  spin?: boolean;
  heading: string;
  body: ReactNode;
  /** Shown on its own line when the body does not already carry the reference. */
  reference?: string;
  actions?: ReactNode;
};

function StatusIcon({ outcome }: { outcome: Outcome }) {
  const reduce = useReducedMotion();
  const colors = TONE[outcome.tone];
  const Icon = outcome.icon;
  return (
    <span className="relative size-12 shrink-0">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={outcome.key}
          className={cn(
            "absolute inset-0 grid place-items-center rounded-full",
            colors.surface,
            colors.text,
          )}
          initial={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.25, filter: "blur(4px)" }
          }
          animate={
            reduce
              ? { opacity: 1 }
              : { opacity: 1, scale: 1, filter: "blur(0px)" }
          }
          exit={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.25, filter: "blur(4px)" }
          }
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        >
          <Icon
            aria-hidden="true"
            className={cn(
              "size-6",
              outcome.spin && "animate-spin motion-reduce:animate-none",
            )}
          />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function OutcomeCard({ outcome }: { outcome: Outcome }) {
  return (
    <section className={cn(card, "grid max-w-xl gap-5 p-6")}>
      <div className="flex items-start gap-4">
        <StatusIcon outcome={outcome} />
        {/* Heading and body are the live region: the outcome is announced, and the icon never is the only cue. */}
        <div aria-live="polite" className="grid min-w-0 flex-1 gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-2xl">
            {outcome.heading}
          </h1>
          <div className="grid gap-2 text-sm text-pretty text-[var(--color-text-secondary)]">
            {outcome.body}
          </div>
          {outcome.reference && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Reference <Reference value={outcome.reference} />
            </p>
          )}
        </div>
      </div>
      {outcome.actions && (
        <div className="flex flex-wrap gap-3">{outcome.actions}</div>
      )}
    </section>
  );
}

export function PaymentResultPage({ feeId }: { feeId: string }) {
  const searchParams = useSearchParams();
  const tranId = searchParams.get("tran")?.trim() || null;
  const query = usePaymentAttempt(feeId, tranId);
  const checkout = useCheckout(feeId);

  const view: PaymentAttemptView | undefined = query.data;
  const waiting =
    tranId !== null &&
    !query.isError &&
    (view === undefined || view.status === "PENDING");
  const longWait = useElapsedWhile(waiting) >= LONG_WAIT_MS;
  const feeHref = `/dashboard/fees/${encodeURIComponent(feeId)}`;

  const notFound: Outcome = {
    key: "missing",
    tone: "neutral",
    icon: CircleAlert,
    heading: "We couldn't find this payment.",
    body: <p>It may have been removed, or the link is incomplete.</p>,
    actions: (
      <Link
        href={feeHref}
        className="text-sm font-semibold text-[var(--color-primary-core)] underline-offset-4 hover:underline"
      >
        Open the fee
      </Link>
    ),
  };

  let outcome: Outcome;
  if (tranId === null) {
    outcome = notFound;
  } else if (query.isError) {
    const missing =
      query.error instanceof ApiError && query.error.status === 404;
    outcome = missing
      ? notFound
      : {
          key: "error",
          tone: "neutral",
          icon: CircleAlert,
          heading: "Couldn't load this payment.",
          body: <p>Check your connection and try again.</p>,
          actions: (
            <button
              type="button"
              onClick={() => void query.refetch()}
              className={cn(secondaryButton, "min-h-11")}
            >
              Try again
            </button>
          ),
        };
  } else if (view === undefined) {
    outcome = pendingOutcome(tranId, longWait);
  } else {
    // Retry is offered only while the fee can still take a payment; a paid or closed fee would 409.
    const retry = isFeeOpen(view.fee) ? (
      <button
        type="button"
        onClick={() =>
          checkout.mutate(undefined, {
            onError: (err) => toastError("Couldn't start a new payment.", err),
          })
        }
        disabled={checkout.isPending}
        aria-busy={checkout.isPending || undefined}
        className={cn(primaryButton, "min-h-11")}
      >
        {checkout.isPending ? "Starting..." : "Try again"}
      </button>
    ) : null;
    outcome = statusOutcome(view, { tranId, feeId, retry, longWait });
  }

  return (
    <PageFrame>
      <div className="grid gap-6">
        <BackLink href={feeHref}>Fee</BackLink>
        <OutcomeCard outcome={outcome} />
      </div>
    </PageFrame>
  );
}

function pendingOutcome(tranId: string, longWait: boolean): Outcome {
  return {
    key: "loading",
    tone: "brand",
    icon: LoaderCircle,
    spin: true,
    heading: "Confirming your payment",
    body: (
      <>
        <p>
          This usually takes a few seconds. You can leave this page; we&apos;ll
          keep checking.
        </p>
        {longWait && (
          <p>
            Still waiting on SSLCommerz. If money left your account, it&apos;ll
            show on this fee within a few minutes.
          </p>
        )}
      </>
    ),
    reference: tranId,
  };
}

function statusOutcome(
  view: PaymentAttemptView,
  {
    tranId,
    feeId,
    retry,
    longWait,
  }: { tranId: string; feeId: string; retry: ReactNode; longWait: boolean },
): Outcome {
  switch (view.status) {
    case "PENDING":
      return pendingOutcome(tranId, longWait);
    case "SUCCEEDED": {
      const charged = Number(view.chargeAmount) > 0;
      const stillDue = Number(view.fee.remaining) > 0;
      return {
        key: "SUCCEEDED",
        tone: "success",
        icon: CircleCheck,
        heading: "Payment received",
        body: (
          <>
            <p className="tabular-nums">
              You paid {formatMoney(view.totalAmount)}.{" "}
              {formatMoney(view.feeAmount)} went to your placement fee
              {charged
                ? ` and ${formatMoney(view.chargeAmount)} covered the processing charge.`
                : "."}
            </p>
            <p className="tabular-nums">
              {stillDue
                ? `${formatMoney(view.fee.remaining)} is still due.`
                : "This fee is fully paid."}
            </p>
          </>
        ),
        reference: tranId,
        actions: (
          <>
            <Link
              href={`/dashboard/fees/${encodeURIComponent(feeId)}`}
              className={cn(primaryButton, "min-h-11")}
            >
              View fee
            </Link>
            <Link
              href="/dashboard/fees"
              className={cn(secondaryButton, "min-h-11")}
            >
              All fees
            </Link>
          </>
        ),
      };
    }
    case "FAILED":
      return {
        key: "FAILED",
        tone: "error",
        icon: CircleX,
        heading: "Payment didn't go through",
        body: (
          <p>
            SSLCommerz didn&apos;t complete this payment. If money left your
            account anyway, contact us with reference{" "}
            <Reference value={tranId} />.
          </p>
        ),
        actions: retry,
      };
    case "CANCELLED":
      return {
        key: "CANCELLED",
        tone: "neutral",
        icon: Ban,
        heading: "Payment cancelled",
        body: <p>You cancelled on SSLCommerz. Nothing was charged.</p>,
        reference: tranId,
        actions: retry,
      };
    case "EXPIRED":
      return {
        key: "EXPIRED",
        tone: "warning",
        icon: Clock,
        heading: "Payment session expired",
        body: <p>This checkout timed out before it was paid.</p>,
        reference: tranId,
        actions: retry,
      };
    case "REVIEW":
      return {
        key: "REVIEW",
        tone: "warning",
        icon: TriangleAlert,
        heading: "We're checking this payment",
        body: (
          <p>
            SSLCommerz reported this payment, but something didn&apos;t match,
            so a person will check it. Don&apos;t pay again. Reference{" "}
            <Reference value={tranId} />.
          </p>
        ),
      };
    case "UNAPPLIED":
      return {
        key: "UNAPPLIED",
        tone: "warning",
        icon: Undo2,
        heading: "Payment received, but not applied",
        body: (
          <p>
            This fee was already paid or closed when your payment arrived, so
            we&apos;ll refund it. Reference <Reference value={tranId} />.
          </p>
        ),
      };
  }
}
