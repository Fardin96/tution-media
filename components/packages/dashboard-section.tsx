"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  card,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { MyPackageCard } from "@/components/packages/my-package-card";
import { accentAt } from "@/components/ui/listing-card";
import { useEducationLookup } from "@/lib/education";
import { useMyPackages } from "@/lib/packages";

const NEW_PACKAGE_HREF = "/dashboard/tutor/packages/new";
const ALL_HREF = "/dashboard/tutor/packages";
const VISIBLE = 2;

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

/** The tutor dashboard's packages block: live offers first, two at most, with a link to the full list. */
export function TutorPackagesSection() {
  const packages = useMyPackages();
  const lookup = useEducationLookup();

  const list = packages.data?.packages ?? [];
  const live = list.filter((pkg) => pkg.status === "OPEN");
  const visible = live.slice(0, VISIBLE);

  return (
    <section
      id="packages"
      aria-labelledby="packages-heading"
      className="scroll-mt-24"
    >
      <SectionHeading
        id="packages-heading"
        title="Your tuition packages"
        description="Offers students can find and request."
        action={
          // With no packages, the empty card carries the only create button.
          list.length === 0 ? undefined : (
            <Link href={NEW_PACKAGE_HREF} className={primaryButton}>
              <Plus aria-hidden="true" className="size-4" />
              New package
            </Link>
          )
        }
      />

      {packages.isPending ? (
        <div
          role="status"
          className={cn(
            card,
            "mt-5 h-64 animate-pulse p-5 motion-reduce:animate-none",
          )}
        >
          <span className="sr-only">Loading your packages</span>
        </div>
      ) : packages.isError ? (
        <div
          className={cn(
            card,
            "mt-5 flex flex-col items-center gap-3 p-6 text-center",
          )}
        >
          <p className="text-sm text-[var(--color-text-secondary)]">
            Couldn&apos;t load your packages.
          </p>
          <button
            type="button"
            onClick={() => void packages.refetch()}
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
            You have no packages yet.
          </p>
          <Link href={NEW_PACKAGE_HREF} className={primaryButton}>
            <Plus aria-hidden="true" className="size-4" />
            Create a package
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className={cn(card, "mt-5 p-5")}>
          <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
            None of your packages are live right now.
          </p>
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {visible.map((pkg, index) => (
            <li key={pkg.id}>
              <MyPackageCard
                pkg={pkg}
                lookup={lookup.data}
                accent={accentAt(index)}
              />
            </li>
          ))}
        </ul>
      )}

      {!packages.isPending && !packages.isError && list.length > 0 && (
        <div className="mt-4">
          <Link href={ALL_HREF} className={cn(ghostButton, "min-h-10")}>
            See all packages
          </Link>
        </div>
      )}
    </section>
  );
}
