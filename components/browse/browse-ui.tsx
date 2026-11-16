import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import {
  card,
  focusRing,
  ghostButton,
  secondaryButton,
} from "@/components/profile/styles";
import { cn } from "@/lib/utils";

export const SEGMENT_TRACK =
  "inline-flex max-w-full flex-wrap gap-1 rounded-full bg-[var(--color-surface-subtle)] p-1";
export const SEGMENT_SELECTED =
  "bg-[var(--color-neutral-white)] text-[var(--color-neutral-charcoal)] shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.06)]";
export const SEGMENT_IDLE =
  "text-[var(--color-text-secondary)] hover:text-[var(--color-neutral-charcoal)]";
export const SEGMENT_BUTTON = `min-h-10 rounded-full px-4 text-sm font-semibold transition-[background-color,box-shadow,color] duration-150 ease-out active:scale-[0.96] motion-reduce:transition-none ${focusRing}`;

export function BackLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={cn(ghostButton, "-ms-3 min-h-10 self-start px-3")}
    >
      <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      {children}
    </Link>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className={SEGMENT_TRACK}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              SEGMENT_BUTTON,
              selected ? SEGMENT_SELECTED : SEGMENT_IDLE,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label
        htmlFor={id}
        className="text-sm font-medium text-[var(--color-neutral-charcoal)]"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "min-h-11 min-w-0 rounded-xl bg-[var(--color-neutral-white)] px-3 text-sm text-[var(--color-neutral-charcoal)] shadow-[0_0_0_1px_rgb(0_0_0/0.1),0_1px_2px_rgb(0_0_0/0.06)] transition-[box-shadow] duration-150 ease-out motion-reduce:transition-none",
          focusRing,
        )}
      >
        {children}
      </select>
    </div>
  );
}

export function SkeletonCards({
  label,
  count = 6,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div
      role="status"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-44 animate-pulse rounded-[24px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

export function ErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className={cn(
        card,
        "flex flex-wrap items-center justify-between gap-4 p-5",
      )}
    >
      <p className="text-sm text-[var(--color-neutral-charcoal)]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(secondaryButton, "min-h-10 px-4")}
      >
        Try again
      </button>
    </div>
  );
}

export function EmptyCard({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn(card, "grid gap-3 p-6")}>
      <p className="font-semibold text-[var(--color-neutral-charcoal)]">
        {title}
      </p>
      {body && (
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          {body}
        </p>
      )}
      {children && <div className="mt-1 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function RatingInline({
  ratingAvg,
  ratingCount,
}: {
  ratingAvg: number;
  ratingCount: number;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-[var(--color-neutral-charcoal)]">
      {ratingCount > 0 && (
        <Star
          aria-hidden="true"
          className="size-4 fill-[var(--color-semantic-warning)] text-[var(--color-semantic-warning)]"
        />
      )}
      {ratingCount === 0 ? (
        <span className="font-semibold">New</span>
      ) : (
        <>
          <span className="font-semibold tabular-nums">
            {ratingAvg.toFixed(1)}
          </span>
          <span className="text-[var(--color-text-secondary)] tabular-nums">
            ({ratingCount} {ratingCount === 1 ? "review" : "reviews"})
          </span>
        </>
      )}
    </span>
  );
}

export function TutorInitial({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden="true"
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary-sky)] text-base font-semibold text-[var(--color-primary-deep)]"
    >
      {initial}
    </span>
  );
}

/** Client errors other than auth and rate limits: the nearby search reads these as "no saved location". */
export function isClientError(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  return (
    typeof status === "number" &&
    status >= 400 &&
    status < 500 &&
    status !== 401 &&
    status !== 429
  );
}
