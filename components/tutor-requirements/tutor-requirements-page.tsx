"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  card,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { RequirementPageShell } from "@/components/requirements/requirement-page-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEducationLookup } from "@/lib/education";
import { optionName } from "@/lib/profile";
import { useSubjects } from "@/lib/subjects";
import {
  MAX_ACTIVE_SETS,
  useProfileSubjects,
  useTutorRequirements,
  type TutorRequirement,
} from "@/lib/tutor-requirements";
import { TutorRequirementCard } from "@/components/tutor-requirements/tutor-requirement-card";
import { accentAt } from "@/components/ui/listing-card";
import { useSetActions } from "@/components/tutor-requirements/use-set-actions";

const NEW_SET_HREF = "/dashboard/tutor/requirements/new";
const LIMIT_HINT_ID = "requirement-limit-hint";

const editHref = (id: string) => `/dashboard/tutor/requirements/${id}/edit`;

function SkeletonCards({ count }: { count: number }) {
  return (
    <div role="status" className="mt-5 grid gap-4 sm:grid-cols-2">
      <span className="sr-only">Loading your sets</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(card, "h-36 animate-pulse p-5")}
        />
      ))}
    </div>
  );
}

function EmptyBlock({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        card,
        "mt-5 flex flex-col items-center gap-3 p-6 text-center",
      )}
    >
      <p className="font-semibold text-[var(--color-neutral-charcoal)]">
        {title}
      </p>
      {children}
    </div>
  );
}

export function TutorRequirementsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requirements = useTutorRequirements("all");
  const profileSubjects = useProfileSubjects();
  const lookup = useEducationLookup();
  const { archive, restore, makeDefault, pendingId } = useSetActions();

  const { active, archived } = useMemo(() => {
    const all = requirements.data ?? [];
    return {
      active: all.filter((s) => s.isActive),
      archived: all.filter((s) => !s.isActive),
    };
  }, [requirements.data]);

  const loaded = requirements.data !== undefined;
  const atLimit = active.length >= MAX_ACTIVE_SETS;
  const tab = searchParams.get("tab") === "archived" ? "archived" : "active";

  const { subjects } = useSubjects();
  const subjectNames = (id: number) => {
    const fromProfile = profileSubjects.data?.find((s) => s.id === id);
    return fromProfile ? fromProfile.name : optionName(subjects, id);
  };

  const onTabChange = (value: string) => {
    router.replace(
      value === "archived" ? `${pathname}?tab=archived` : pathname,
      { scroll: false },
    );
  };

  // With no active sets, the empty card carries the only create button.
  const newSetButton =
    active.length === 0 ? null : atLimit ? (
      <button
        type="button"
        aria-disabled="true"
        aria-describedby={LIMIT_HINT_ID}
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
    );

  const activeBody = !loaded ? (
    <SkeletonCards count={2} />
  ) : active.length === 0 ? (
    <EmptyBlock title="No active sets yet. Create one so you can apply to tuitions.">
      <Link href={NEW_SET_HREF} className={primaryButton}>
        <Plus aria-hidden="true" className="size-4" />
        New set
      </Link>
    </EmptyBlock>
  ) : (
    <ul className="mt-5 grid gap-4 sm:grid-cols-2">
      {active.map((set, index) => (
        <li key={set.id}>
          <TutorRequirementCard
            set={set}
            lookup={lookup.data}
            subjectNames={subjectNames}
            accent={accentAt(index)}
            actions={
              <>
                <Link
                  href={editHref(set.id)}
                  className={cn(secondaryButton, "min-h-10 px-4")}
                >
                  Edit
                </Link>
                {!set.isDefault && (
                  <>
                    <button
                      type="button"
                      disabled={pendingId === set.id}
                      onClick={() => void makeDefault(set)}
                      className={cn(secondaryButton, "min-h-10 px-4")}
                    >
                      Make default
                    </button>
                    <button
                      type="button"
                      disabled={pendingId === set.id}
                      onClick={() => void archive(set)}
                      className={cn(ghostButton, "min-h-10 px-4")}
                    >
                      Archive
                    </button>
                  </>
                )}
              </>
            }
          />
        </li>
      ))}
    </ul>
  );

  const archivedBody = !loaded ? (
    <SkeletonCards count={1} />
  ) : archived.length === 0 ? (
    <EmptyBlock title="Nothing archived." />
  ) : (
    <>
      {atLimit && (
        <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
          {`You have ${MAX_ACTIVE_SETS} active sets. Archive one before you restore another.`}
        </p>
      )}
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {archived.map((set: TutorRequirement, index) => {
          const noSubjects = set.subjectIds.length === 0;
          return (
            <li key={set.id}>
              <TutorRequirementCard
                set={set}
                lookup={lookup.data}
                subjectNames={subjectNames}
                accent={accentAt(index)}
                actions={
                  noSubjects ? (
                    <>
                      <Link
                        href={editHref(set.id)}
                        className={cn(primaryButton, "min-h-10 px-4")}
                      >
                        Edit set
                      </Link>
                      <p className="basis-full text-sm text-[var(--color-semantic-error-text)]">
                        Add a subject before restoring.
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={atLimit || pendingId === set.id}
                        title={
                          atLimit ? "Archive an active set first" : undefined
                        }
                        onClick={() => void restore(set)}
                        className={cn(primaryButton, "min-h-10 px-4")}
                      >
                        Restore
                      </button>
                      <Link
                        href={editHref(set.id)}
                        className={cn(secondaryButton, "min-h-10 px-4")}
                      >
                        Edit
                      </Link>
                    </>
                  )
                }
              />
            </li>
          );
        })}
      </ul>
    </>
  );

  return (
    <RequirementPageShell
      title="Requirement sets"
      description="Each set says which classes, subjects and times you take."
      eyebrow="Teaching"
    >
      <div className="mt-8 flex flex-col gap-2">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            {loaded ? `${active.length} of ${MAX_ACTIVE_SETS} active` : ""}
          </p>
          {newSetButton}
        </div>
        {atLimit && (
          <p
            id={LIMIT_HINT_ID}
            className="text-sm text-[var(--color-text-secondary)]"
          >
            {`You have ${MAX_ACTIVE_SETS} active sets. Archive one to add another.`}
          </p>
        )}
      </div>

      {requirements.isError ? (
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
            onClick={() => void requirements.refetch()}
            className={cn(secondaryButton, "min-h-10 px-4")}
          >
            Try again
          </button>
        </div>
      ) : (
        <Tabs value={tab} onValueChange={onTabChange} className="mt-6">
          <TabsList>
            <TabsTrigger value="active">
              {loaded ? `Active (${active.length})` : "Active"}
            </TabsTrigger>
            <TabsTrigger value="archived">
              {loaded ? `Archived (${archived.length})` : "Archived"}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="active">{activeBody}</TabsContent>
          <TabsContent value="archived">{archivedBody}</TabsContent>
        </Tabs>
      )}
    </RequirementPageShell>
  );
}
