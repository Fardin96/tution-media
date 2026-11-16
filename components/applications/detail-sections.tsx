import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { card } from "@/components/profile/styles";

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
      className={cn(card, "p-5")}
    >
      <h2
        id={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
        className="text-base font-semibold text-[var(--color-neutral-charcoal)]"
      >
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Rows({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
        >
          <dt className="text-xs font-medium text-[var(--color-text-secondary)]">
            {row.label}
          </dt>
          <dd className="mt-1 text-sm font-medium text-pretty text-[var(--color-neutral-charcoal)] tabular-nums">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
