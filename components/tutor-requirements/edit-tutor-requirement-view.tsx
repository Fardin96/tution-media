"use client";

import Link from "next/link";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/profile";
import { useTutorRequirement } from "@/lib/tutor-requirements";
import { TutorRequirementForm } from "@/components/tutor-requirements/tutor-requirement-form";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";

export function EditTutorRequirementView({ id }: { id: string }) {
  const query = useTutorRequirement(id);

  if (query.isPending) {
    return (
      <div
        className={cn(card, "mt-6 p-6 sm:p-8")}
        aria-label="Loading requirement set"
      >
        <div className="grid gap-4">
          <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
          <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
          <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    const notFound =
      query.error instanceof ApiError && query.error.status === 404;

    return (
      <div className={cn(card, "mt-6 p-6 text-center sm:p-8")} role="alert">
        <h2 className="text-lg font-semibold text-[var(--color-neutral-charcoal)] sm:text-xl">
          {notFound
            ? "This set doesn't exist or isn't yours."
            : "Couldn't load this set."}
        </h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard/tutor/requirements"
            className={secondaryButton}
          >
            Back to requirement sets
          </Link>
          {!notFound && (
            <button
              type="button"
              onClick={() => void query.refetch()}
              className={primaryButton}
            >
              <RotateCw aria-hidden="true" className="size-4" />
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  const set = query.data;

  return (
    <>
      {set.isActive === false && (
        <div
          role="status"
          className="mt-6 rounded-[16px] bg-[var(--color-secondary-sky)] p-4 text-sm text-[var(--color-primary-deep)]"
        >
          This set is archived. You can still edit it; restore it from your
          requirement sets to use it again.
        </div>
      )}
      <TutorRequirementForm initialData={set} />
    </>
  );
}
