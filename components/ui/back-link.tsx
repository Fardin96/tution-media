import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ghostButton } from "@/components/profile/styles";
import { cn } from "@/lib/utils";

/** The one back control: blue, leading-aligned, pulled out by its padding so the arrow lines up with the content edge. */
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <Link
      href={href}
      className={cn(ghostButton, "-ms-3 min-h-10 self-start px-3")}
    >
      <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      {children}
    </Link>
  );
}
