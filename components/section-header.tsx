import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Set on the <h2> so the parent section can use aria-labelledby. */
  titleId?: string;
  /** `center`: stacked, width-capped (categories). `start`: left-aligned, full width (testimonials). */
  align?: "center" | "start";
  className?: string;
};

export function SectionHeader({
  title,
  description,
  titleId,
  align = "center",
  className,
}: SectionHeaderProps) {
  const center = align === "center";
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        center ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      <h2
        id={titleId}
        className={cn(
          "text-[1.75rem] leading-[1.2] font-medium text-balance text-[var(--color-neutral-charcoal)] sm:text-[2.5rem] lg:text-[3.5rem]",
          center && "max-w-[30.125rem]",
        )}
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
