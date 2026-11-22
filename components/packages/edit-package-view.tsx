"use client";

import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyPackages } from "@/lib/packages";
import { PackageForm } from "@/components/packages/package-form";
import { PendingLabel } from "@/components/ui/pending-label";
import { card, primaryButton } from "@/components/profile/styles";

export function EditPackageView({ id }: { id: string }) {
  // The edit form needs zoneIds, which only the list returns (GET /packages/{id} omits them).
  const mine = useMyPackages();

  if (mine.isError) {
    return (
      <div className={cn(card, "mt-6 p-6 text-center sm:p-8")} role="alert">
        <h2 className="text-lg font-semibold text-[var(--color-neutral-charcoal)] sm:text-xl">
          Couldn&apos;t load this package.
        </h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => void mine.refetch()}
            disabled={mine.isFetching}
            aria-busy={mine.isFetching || undefined}
            className={primaryButton}
          >
            <PendingLabel pending={mine.isFetching}>
              <RotateCw aria-hidden="true" className="size-4" />
              Try again
            </PendingLabel>
          </button>
        </div>
      </div>
    );
  }

  if (mine.isPending) {
    return (
      <div className={cn(card, "mt-6 p-6 sm:p-8")} aria-label="Loading package">
        <div className="grid gap-4">
          <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
          <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
          <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  const pkg = mine.data.packages.find((p) => p.id === id);

  if (!pkg) {
    return (
      <div className={cn(card, "mt-6 p-6 sm:p-8")}>
        <h2 className="text-lg font-semibold text-[var(--color-neutral-charcoal)] sm:text-xl">
          This package isn&apos;t available.
        </h2>
        <p className="mt-2 text-sm text-pretty text-[var(--color-text-secondary)]">
          It may have been removed, or it belongs to another tutor.
        </p>
      </div>
    );
  }

  if (pkg.status !== "OPEN") {
    return (
      <div className={cn(card, "mt-6 p-6 sm:p-8")}>
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          Closed packages can&apos;t be edited.
        </p>
      </div>
    );
  }

  return <PackageForm mode="edit" initial={pkg} />;
}
