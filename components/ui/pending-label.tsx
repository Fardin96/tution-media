import SpinnerEllipsis from "@/components/shadcn-space/spinner/spinner-05";
import { cn } from "@/lib/utils";

/**
 * Button content that turns into Spinner 05 while a request runs. The label only fades (it
 * stays in place), so the button keeps its size and its accessible name. The swap waits
 * 100 ms, so quick answers don't flicker. The button itself still needs `disabled` and
 * `aria-busy` while pending. The spinner takes the text colour: white on primary buttons.
 */
export function PendingLabel({
  pending,
  children,
  className,
}: {
  pending: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center gap-[inherit]",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex items-center justify-center gap-[inherit] transition-opacity duration-150 ease-out",
          pending && "opacity-0 delay-100",
        )}
      >
        {children}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-150 ease-out",
          pending ? "opacity-100 delay-100" : "opacity-0",
        )}
      >
        {pending && <SpinnerEllipsis />}
      </span>
    </span>
  );
}
