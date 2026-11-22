import { cn } from "@/lib/utils";

// shadcn/ui Skeleton with a soft shimmer (still under reduced motion). Hidden from screen
// readers: the loading region around it carries role="status" and the text ("Loading tutors").
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "relative isolate overflow-hidden rounded-md bg-[var(--color-skeleton)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[skeleton-shimmer_1.6s_ease-in-out_infinite] after:bg-linear-to-r after:from-transparent after:via-white/50 after:to-transparent motion-reduce:after:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
