import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  ghostButton,
  card,
  secondaryButton,
} from "@/components/profile/styles";
import { StatusPill, TonePill } from "@/components/applications/status-pill";
import { formatDay, subjectNames } from "@/components/applications/format";
import type { TuitionPackage } from "@/lib/browse";
import { useEducationLookup } from "@/lib/education";
import { durationLabel, packageLevelText, priceLabel } from "@/lib/packages";
import { daysSummary, formatTimeRange } from "@/lib/tutor-requirements";
import { cn } from "@/lib/utils";
import { RatingInline } from "./browse-ui";

/** Students see where a package happens. Zone counts are private to the tutor. */
export function studentPlaceText(
  pkg: Pick<TuitionPackage, "teachesOnline" | "zoneCount">,
): string {
  const inPerson = pkg.zoneCount > 0;
  if (pkg.teachesOnline && inPerson) return "Online or in person";
  if (pkg.teachesOnline) return "Online";
  return inPerson ? "In person" : "To be agreed";
}

/** Renders an `<li>`; the parent list is a `<ul>`. */
export function PackageCard({ pkg }: { pkg: TuitionPackage }) {
  const { data: lookup } = useEducationLookup();
  const subjects = subjectNames(pkg.subjectIds);
  const mine = pkg.myApplication;

  return (
    <li className={cn(card, "flex flex-col gap-4 p-5")}>
      <div className="grid gap-1">
        <h3 className="font-semibold text-pretty text-[var(--color-neutral-charcoal)]">
          {pkg.title}
        </h3>
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          {[subjects, packageLevelText(lookup, pkg)]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--color-neutral-charcoal)]">
        <span>Taught by {pkg.tutor.name}</span>
        <RatingInline
          ratingAvg={pkg.tutor.ratingAvg}
          ratingCount={pkg.tutor.ratingCount}
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div className="min-w-0">
          <dt className="text-[var(--color-text-secondary)]">Place</dt>
          <dd className="font-medium text-[var(--color-neutral-charcoal)]">
            {studentPlaceText(pkg)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--color-text-secondary)]">Schedule</dt>
          <dd className="font-medium text-[var(--color-neutral-charcoal)] tabular-nums">
            {daysSummary(pkg)} · {formatTimeRange(pkg.timeFrom, pkg.timeTo)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--color-text-secondary)]">Price</dt>
          <dd className="font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
            {priceLabel(pkg.price)}
            <span className="font-normal text-[var(--color-text-secondary)]">
              {" "}
              total
            </span>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--color-text-secondary)]">Duration</dt>
          <dd className="font-medium text-[var(--color-neutral-charcoal)] tabular-nums">
            {durationLabel(pkg.durationWeeks)}
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-[var(--color-text-secondary)]">Available from</dt>
          <dd className="font-medium text-[var(--color-neutral-charcoal)]">
            {formatDay(pkg.availableFrom)}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
        {mine ? (
          <>
            <StatusPill status={mine.status} />
            <Link
              href={`/dashboard/applications/${mine.id}`}
              className={cn(secondaryButton, "min-h-10 px-4")}
            >
              View<span className="sr-only"> your request for {pkg.title}</span>
            </Link>
          </>
        ) : pkg.closed ? (
          <TonePill tone="neutral">Application closed</TonePill>
        ) : (
          <Link
            href={`/dashboard/find-tutors/packages/${pkg.id}`}
            className={cn(ghostButton, "min-h-10 px-3")}
          >
            View package
            <span className="sr-only"> {pkg.title}</span>
            <ArrowRight
              aria-hidden="true"
              className="size-4 rtl:-scale-x-100"
            />
          </Link>
        )}
      </div>
    </li>
  );
}
