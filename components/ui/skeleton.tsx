import { cn } from "@/lib/utils";

// shadcn/ui Skeleton. Hidden from screen readers: the loading region around it carries the
// role="status" and the text ("Loading tutors").
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "bg-accent animate-pulse rounded-md motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
