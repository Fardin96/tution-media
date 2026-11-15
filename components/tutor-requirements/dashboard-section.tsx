"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  card,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { TutorRequirementCard } from "@/components/tutor-requirements/tutor-requirement-card";
import { useEducationLookup } from "@/lib/education";
import { optionName, SUBJECTS } from "@/lib/profile";
import {
  MAX_ACTIVE_SETS,
  dashboardVisibleCount,
  useProfileSubjects,
  useTutorRequirements,
} from "@/lib/tutor-requirements";

const NEW_SET_HREF = "/dashboard/tutor/requirements/new";
const ALL_HREF = "/dashboard/tutor/requirements";

function SectionHeading({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2
          id={id}
          className="text-xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] sm:text-2xl"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function TutorRequirementsSection() {
  const sets = useTutorRequirements("active");
  const lookup = useEducationLookup();
  const profileSubjects = useProfileSubjects();
  const [step, setStep] = useState<0 | 1>(0);
  // Id of the first newly revealed card, focused once "View more" renders it.
  const pendingFocus = useRef<string | null>(null);

  const list = sets.data ?? [];
  const atLimit = list.length >= MAX_ACTIVE_SETS;

  useEffect(() => {
    const id = pendingFocus.current;
    if (step === 1 && id) {
      pendingFocus.current = null;
      document.getElementById(`set-title-${id}`)?.focus();
    }
  }, [step]);

  const viewMore = () => {
    pendingFocus.current = list[1]?.id ?? null;
    setStep(1);
  };

  const subjectNames = (id: number) => {
    const fromProfile = profileSubjects.data?.find((s) => s.id === id);
    return fromProfile ? fromProfile.name : optionName(SUBJECTS, id);
  };

  const visible = list.slice(0, dashboardVisibleCount(step, list.length));
  const showViewMore = step === 0 && list.length > 1;

  return (
    <section
      id="requirement-sets"
      aria-labelledby="requirement-sets-heading"
      className="scroll-mt-24"
    >
      <SectionHeading
        id="requirement-sets-heading"
        title="Requirement sets"
        description="Packages use your default set unless they pick another."
        action={
          atLimit ? (
            <button
              type="button"
              aria-disabled="true"
              onClick={(e) => e.preventDefault()}
              className={cn(
                primaryButton,
                "aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:shadow-none aria-disabled:hover:bg-[var(--color-primary-core)] aria-disabled:active:scale-100",
              )}
            >
              <Plus aria-hidden="true" className="size-4" />
              New set
            </button>
          ) : (
            <Link href={NEW_SET_HREF} className={primaryButton}>
              <Plus aria-hidden="true" className="size-4" />
              New set
            </Link>
          )
        }
      />

      {sets.isPending ? (
        <div role="status" className={cn(card, "mt-5 h-36 animate-pulse p-5")}>
          <span className="sr-only">Loading your sets</span>
        </div>
      ) : sets.isError ? (
        <div
          className={cn(
            card,
            "mt-5 flex flex-col items-center gap-3 p-6 text-center",
          )}
        >
          <p className="text-sm text-[var(--color-text-secondary)]">
            Couldn&apos;t load your sets.
          </p>
          <button
            type="button"
            onClick={() => void sets.refetch()}
            className={cn(secondaryButton, "min-h-10 px-4")}
          >
            Try again
          </button>
        </div>
      ) : list.length === 0 ? (
        <div
          className={cn(
            card,
            "mt-5 flex flex-col items-center gap-3 p-6 text-center",
          )}
        >
          <p className="font-semibold text-[var(--color-neutral-charcoal)]">
            You need a default set before you can apply to tuitions.
          </p>
          <Link href={NEW_SET_HREF} className={primaryButton}>
            <Plus aria-hidden="true" className="size-4" />
            Create a set
          </Link>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4">
          {visible.map((set) => (
            <li
              key={set.id}
              className={cn(
                step === 1 &&
                  "transition-[opacity,translate] duration-150 ease-out motion-reduce:transition-none starting:translate-y-1 starting:opacity-0",
              )}
            >
              <TutorRequirementCard
                set={set}
                lookup={lookup.data}
                subjectNames={subjectNames}
                actions={
                  <Link
                    href={`/dashboard/tutor/requirements/${set.id}/edit`}
                    className={cn(secondaryButton, "min-h-10 px-4")}
                  >
                    Edit
                  </Link>
                }
              />
            </li>
          ))}
        </ul>
      )}

      {!sets.isPending && !sets.isError && (
        <div className="mt-4">
          {showViewMore ? (
            <button
              type="button"
              onClick={viewMore}
              className={cn(ghostButton, "min-h-10")}
            >
              View more
            </button>
          ) : (
            <Link href={ALL_HREF} className={cn(ghostButton, "min-h-10")}>
              See all requirements
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
