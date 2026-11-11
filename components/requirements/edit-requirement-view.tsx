"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { RequirementPageShell } from "@/components/requirements/requirement-page-shell";
import { RequirementForm } from "@/components/requirements/requirement-form";
import { requirementApi, type Requirement } from "@/lib/requirements";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";

export function EditRequirementView({ id }: { id: string }) {
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    requirementApi
      .get(id)
      .then((data) => {
        if (!live) return;
        if (data.status === "CLOSED") {
          setError("This requirement is closed, so it can't be edited.");
        } else {
          setRequirement(data);
        }
      })
      .catch((err) => {
        if (!live) return;
        const status = (err as { status?: number }).status;
        if (status === 404) {
          setError("This requirement doesn't exist or isn't yours.");
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Couldn't load requirement details.",
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [id]);

  return (
    <RequirementPageShell
      title="Edit requirement"
      description="Update details about your tuition requirement."
    >
      {loading ? (
        <div
          className={cn(card, "mt-6 p-6 sm:p-8")}
          aria-label="Loading requirement"
        >
          <div className="grid gap-4">
            <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
            <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
            <div className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none" />
          </div>
        </div>
      ) : error ? (
        <div className={cn(card, "mt-6 p-6 text-center sm:p-8")} role="alert">
          <h2 className="text-lg font-semibold text-[var(--color-neutral-charcoal)] sm:text-xl">
            {error}
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard" className={secondaryButton}>
              Back to dashboard
            </Link>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setError(null);
                requirementApi
                  .get(id)
                  .then((d) => setRequirement(d))
                  .catch((e) =>
                    setError(e instanceof Error ? e.message : "Error"),
                  )
                  .finally(() => setLoading(false));
              }}
              className={primaryButton}
            >
              <RotateCw aria-hidden="true" className="size-4" />
              Try again
            </button>
          </div>
        </div>
      ) : (
        requirement && <RequirementForm initialData={requirement} />
      )}
    </RequirementPageShell>
  );
}
