"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { card } from "@/components/profile/styles";
import { RequirementForm } from "@/components/requirements/requirement-form";
import { useAreas } from "@/lib/areas";
import { ApiError } from "@/lib/profile";
import { queryKeys } from "@/lib/query-keys";
import { requirementApi, requirementTemplate } from "@/lib/requirements";
import { useSubjects } from "@/lib/subjects";

/** A 4xx means the source is missing or not yours, so retrying cannot help. */
function shouldRetry(failureCount: number, error: unknown) {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

export function PostAgainView({ fromId }: { fromId: string }) {
  const source = useQuery({
    queryKey: queryKeys.requirements.detail(fromId),
    queryFn: () => requirementApi.get(fromId),
    retry: shouldRetry,
  });
  const subjects = useSubjects();
  const areas = useAreas();

  // Built once when all three lists are in. The form reads its initial state at mount only,
  // so later refetches do not overwrite what the student has typed.
  const template = useMemo(() => {
    if (!source.data || !subjects.data || !areas.data) return null;
    return requirementTemplate(source.data, {
      subjectIds: subjects.data.map((s) => s.id),
      areaIds: areas.data.map((a) => a.id),
    });
  }, [source.data, subjects.data, areas.data]);

  if (source.isError || subjects.isError || areas.isError) {
    return (
      <>
        <div
          role="status"
          className="mt-6 rounded-[16px] bg-[var(--color-semantic-warning-surface)] p-4 text-sm font-medium text-pretty text-[var(--color-semantic-warning-text)]"
        >
          We couldn&apos;t copy that requirement. Start from a blank form.
        </div>
        <RequirementForm />
      </>
    );
  }

  if (!template) {
    return (
      <div role="status" className={cn(card, "mt-6 p-6 sm:p-8")}>
        <span className="sr-only">Loading requirement</span>
        <div className="grid gap-4" aria-hidden="true">
          <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
          <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
          <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
        </div>
      </div>
    );
  }

  return (
    <RequirementForm
      key={fromId}
      fromId={fromId}
      template={template.form}
      templateNotes={template.notes}
    />
  );
}
