"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminMe } from "@/lib/admin";
import { card, focusRing } from "@/components/profile/styles";
import { ADMIN_NAV } from "./admin-shell";

/** The admin home: one card per area. Queues that need a decision come first in the nav order. */
export function AdminOverview() {
  const me = useAdminMe();
  const areas = ADMIN_NAV.filter((item) => item.href !== "/dashboard/admin");

  return (
    <div className="flex flex-col">
      <h1 className="text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
        {me.adminUser ? `Hi, ${me.adminUser.name.split(" ")[0]}` : "Admin"}
      </h1>
      <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
        {me.isSuperAdmin
          ? "You're a super admin: you can also approve admins, block accounts and change settings."
          : "Pick an area to work on."}
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {areas.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                card,
                focusRing,
                "group flex min-h-full items-start gap-4 p-5 transition-[box-shadow,scale] duration-150 ease-out active:scale-[0.99] motion-reduce:transition-none",
                "hover:shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.04),0_16px_36px_-12px_rgb(0_0_0/0.12)]",
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-secondary-sky)] text-[var(--color-primary-core)]">
                <item.icon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--color-neutral-charcoal)]">
                  {item.label}
                </span>
                <span className="mt-0.5 block text-sm text-pretty text-[var(--color-text-secondary)]">
                  {item.description}
                </span>
              </span>
              <ChevronRight
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-[var(--color-text-secondary)] rtl:-scale-x-100"
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
