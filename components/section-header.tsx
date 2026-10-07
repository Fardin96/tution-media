import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Set on the <h2> so the parent section can use aria-labelledby. */
  titleId?: string;
  className?: string;
};

export function SectionHeader({
  title,
  description,
  titleId,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn("flex flex-col items-center gap-4 text-center", className)}
    >
      <h2
        id={titleId}
        className="max-w-[30.125rem] text-[1.75rem] leading-[1.2] font-medium text-balance text-[var(--color-neutral-charcoal)] sm:text-[2.5rem] lg:text-[3.5rem]"
      >
        {title}
      </h2>
      {description && (
        <p className="max-w-[24.25rem] text-base leading-6 font-normal text-pretty text-[var(--color-neutral-gray)]">
          {description}
        </p>
      )}
    </div>
  );
}
