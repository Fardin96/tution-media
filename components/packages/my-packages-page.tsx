"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { card, primaryButton } from "@/components/profile/styles";
import { ErrorBlock, EmptyCard } from "@/components/browse/browse-ui";
import { RequirementPageShell } from "@/components/requirements/requirement-page-shell";
import { MyPackageCard } from "@/components/packages/my-package-card";
import { accentAt } from "@/components/ui/listing-card";
import { useEducationLookup } from "@/lib/education";
import { useMyPackages, type MyPackage } from "@/lib/packages";

const NEW_PACKAGE_HREF = "/dashboard/tutor/packages/new";

function SkeletonCards({ count }: { count: number }) {
  return (
    <div role="status" className="grid gap-4 sm:grid-cols-2">
      <span className="sr-only">Loading your packages</span>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(
            card,
            "h-64 animate-pulse p-5 motion-reduce:animate-none",
          )}
        />
      ))}
    </div>
  );
}

function NewPackageLink() {
  return (
    <Link href={NEW_PACKAGE_HREF} className={primaryButton}>
      <Plus aria-hidden="true" className="size-4" />
      New package
    </Link>
  );
}

function PackageList({
  packages,
  lookup,
}: {
  packages: MyPackage[];
  lookup: ReturnType<typeof useEducationLookup>["data"];
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {packages.map((pkg, index) => (
        <li key={pkg.id}>
          <MyPackageCard pkg={pkg} lookup={lookup} accent={accentAt(index)} />
        </li>
      ))}
    </ul>
  );
}

export function MyPackagesPage() {
  const packages = useMyPackages();
  const lookup = useEducationLookup();

  const list: MyPackage[] = packages.data?.packages ?? [];
  const loaded = packages.data !== undefined;
  const live = list.filter((pkg) => pkg.status === "OPEN");
  const closed = list.filter((pkg) => pkg.status !== "OPEN");

  let body: ReactNode;
  if (packages.isError) {
    body = (
      <ErrorBlock
        message="Couldn't load your packages."
        onRetry={() => void packages.refetch()}
      />
    );
  } else if (!loaded) {
    body = <SkeletonCards count={2} />;
  } else if (list.length === 0) {
    // With no packages, the empty card carries the only create button.
    body = (
      <EmptyCard
        title="No packages yet"
        body="Publish a package so students near your zones can request it."
      >
        <NewPackageLink />
      </EmptyCard>
    );
  } else {
    body = (
      <div className="flex flex-col gap-10">
        {live.length > 0 && (
          <PackageList packages={live} lookup={lookup.data} />
        )}
        {closed.length > 0 && (
          <section
            aria-labelledby="closed-packages-heading"
            className="flex flex-col gap-4"
          >
            <h2
              id="closed-packages-heading"
              className="text-sm font-semibold text-[var(--color-text-secondary)]"
            >
              Closed
            </h2>
            <PackageList packages={closed} lookup={lookup.data} />
          </section>
        )}
      </div>
    );
  }

  return (
    <RequirementPageShell
      title="Your packages"
      description="Fixed offers students can request. Each one goes live as soon as you publish it."
      eyebrow="Teaching"
    >
      <div className="mt-8 flex min-h-11 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
          {loaded
            ? `${list.length} ${list.length === 1 ? "package" : "packages"}`
            : ""}
        </p>
        {list.length > 0 && <NewPackageLink />}
      </div>
      <div className="mt-6">{body}</div>
    </RequirementPageShell>
  );
}
