import { cn } from "@/lib/utils";

// Spinner 05 (Ellipsis) from shadcnspace. The keyframes live in app/globals.css, so a page
// with several spinners ships one copy. Decorative: always pair it with text (visible or sr-only).
export default function SpinnerEllipsis({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("flex items-center gap-1.5", className)}
    >
      {[0, 0.2, 0.4].map((delay, i) => (
        <span
          key={i}
          className="spinner-ellipsis-dot size-2 rounded-full bg-current"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}

export { SpinnerEllipsis };
