import Link from "next/link";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { cn } from "@/lib/utils";

type ArrowLinkButtonProps = Omit<
  React.ComponentProps<typeof Link>,
  "as" | "href"
> & {
  /** Omit for a placeholder that renders a <button> and goes nowhere yet (solid only). */
  href?: string;
  /** `glass`: transparent with animated border, for gradient backgrounds. `solid`: white pill, blue badge. */
  variant?: "glass" | "solid";
  containerClassName?: string;
};

function ArrowBadge({ circle, arrow }: { circle: string; arrow: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-full",
        circle,
      )}
    >
      <span
        className={cn(
          "size-3.5 shrink-0 [mask:url(/assets/ic/ic-arrow-up.png)_center/contain_no-repeat]",
          arrow,
        )}
      />
    </span>
  );
}

export function ArrowLinkButton({
  children,
  className,
  containerClassName,
  variant = "glass",
  href,
  ...props
}: ArrowLinkButtonProps) {
  if (variant === "solid") {
    const solidClass = cn(
      "inline-flex items-center gap-4 rounded-full border border-[var(--color-primary-core)] bg-[var(--color-neutral-white)] py-[3px] pr-[3px] pl-[23px] text-base leading-6 font-bold whitespace-nowrap text-[var(--color-primary-core)] transition-[color,scale] duration-150 ease-out hover:text-[var(--color-primary-hover)] active:scale-[0.96]",
      className,
    );
    const badge = (
      <ArrowBadge
        circle="bg-[var(--color-primary-core)]"
        arrow="bg-[var(--color-neutral-white)]"
      />
    );
    if (!href) {
      return (
        <button type="button" className={cn("cursor-pointer", solidClass)}>
          {children}
          {badge}
        </button>
      );
    }
    return (
      <Link {...props} href={href} className={solidClass}>
        {children}
        {badge}
      </Link>
    );
  }

  return (
    <HoverBorderGradient
      as={Link}
      {...props}
      href={href}
      containerClassName={cn(
        "rounded-full border-1 [--hbg-bg:transparent] [--hbg-gradient:#F8F7FF] [--hbg-highlight:white] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]",
        containerClassName,
      )}
      className={cn(
        "flex items-center justify-between gap-4 bg-transparent py-1 pr-1 pl-6 text-lg font-bold whitespace-nowrap text-white",
        className,
      )}
    >
      {children}
      <ArrowBadge
        circle="bg-[var(--color-neutral-white)]"
        arrow="bg-[var(--color-primary-core)]"
      />
    </HoverBorderGradient>
  );
}
