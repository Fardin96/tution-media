"use client";

import type * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileText,
  LayoutGrid,
  MapPin,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminMe } from "@/lib/admin";
import { card, focusRing } from "@/components/profile/styles";
import { LogoutButton } from "@/components/auth/logout-button";

export const ADMIN_NAV = [
  {
    href: "/dashboard/admin",
    label: "Overview",
    icon: LayoutGrid,
    description: "Everything that needs an admin, in one place.",
  },
  {
    href: "/dashboard/admin/packages",
    label: "Packages",
    icon: Package,
    description: "Approve new packages before students can see them.",
  },
  {
    href: "/dashboard/admin/zone-requests",
    label: "Zone requests",
    icon: MapPin,
    description: "Tutors asking for more teaching zones.",
  },
  {
    href: "/dashboard/admin/applications",
    label: "Applications",
    icon: FileText,
    description: "Every application and package request, read-only.",
  },
  {
    href: "/dashboard/admin/fees",
    label: "Fees",
    icon: Wallet,
    description: "Placement fees, cash payments and reversals.",
  },
  {
    href: "/dashboard/admin/accounts",
    label: "Accounts",
    icon: Users,
    description: "Find students, tutors and admins. Block or unblock.",
  },
  {
    href: "/dashboard/admin/team",
    label: "Admin team",
    icon: ShieldCheck,
    description: "Approve new admins or remove them.",
  },
  {
    href: "/dashboard/admin/subjects",
    label: "Subjects",
    icon: BookOpen,
    description: "The subject list tutors and students pick from.",
  },
  {
    href: "/dashboard/admin/settings",
    label: "Settings",
    icon: Settings,
    description: "Commission and the verification switches.",
  },
  {
    href: "/dashboard/admin/audit-log",
    label: "Audit log",
    icon: ScrollText,
    description: "Who changed what, and when.",
  },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Admin chrome: sidebar on wide screens, a scrolling tab row on narrow ones, and the approval gate. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const me = useAdminMe();

  return (
    <div className="min-h-dvh bg-[var(--color-neutral-off-white)] lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:border-e lg:border-[var(--color-neutral-border)] lg:bg-[var(--color-neutral-white)] lg:px-4 lg:py-6">
        <Link
          href="/dashboard/admin"
          aria-label="Admin overview"
          className="px-3"
        >
          <Image
            src="/assets/ic-demo/Icon-blue.png"
            alt="Masters Hub"
            width={860}
            height={220}
            priority
            className="h-10 w-auto"
          />
        </Link>
        <nav aria-label="Admin" className="-mx-1 flex-1 overflow-y-auto px-1">
          <ul className="grid gap-1">
            {ADMIN_NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  href={item.href}
                  active={isActive(pathname, item.href)}
                  icon={item.icon}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-3 border-t border-[var(--color-neutral-border)] pt-4">
          {me.adminUser && (
            <div className="min-w-0 px-3">
              <p className="truncate text-sm font-semibold text-[var(--color-neutral-charcoal)]">
                {me.adminUser.name}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {me.adminUser.adminRole === "SUPER_ADMIN"
                  ? "Super admin"
                  : "Admin"}
              </p>
            </div>
          )}
          <LogoutButton className="h-11 text-sm" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--color-neutral-border)] bg-[color-mix(in_oklab,var(--color-neutral-white)_92%,transparent)] backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-4 px-4 pt-3">
            <Link href="/dashboard/admin" aria-label="Admin overview">
              <Image
                src="/assets/ic-demo/Icon-blue.png"
                alt="Masters Hub"
                width={860}
                height={220}
                priority
                className="h-8 w-auto"
              />
            </Link>
            <LogoutButton className="h-10 w-auto px-4 text-sm" />
          </div>
          {/* The row scrolls; the last tab peeks past the edge so it reads as scrollable. */}
          <nav
            aria-label="Admin"
            className="[scrollbar-width:none] overflow-x-auto"
          >
            <ul className="flex w-max gap-1 px-4 py-2">
              {ADMIN_NAV.map((item) => (
                <li key={item.href}>
                  <NavLink
                    href={item.href}
                    active={isActive(pathname, item.href)}
                    icon={item.icon}
                    compact
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
          {me.isPending ? (
            <div
              aria-hidden="true"
              className={cn(
                card,
                "h-32 animate-pulse motion-reduce:animate-none",
              )}
            />
          ) : me.adminUser && !me.isActive ? (
            <div className={cn(card, "mx-auto max-w-md p-6 text-center")}>
              <h1 className="text-lg font-semibold text-[var(--color-neutral-charcoal)]">
                {me.adminUser.status === "PENDING"
                  ? "Waiting for approval"
                  : "Admin access removed"}
              </h1>
              <p className="mt-2 text-sm text-pretty text-[var(--color-text-secondary)]">
                {me.adminUser.status === "PENDING"
                  ? "A super admin needs to approve your account before you can use the admin pages."
                  : "A super admin removed your admin access. Ask them if this is a mistake."}
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon: Icon,
  compact = false,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-full font-semibold whitespace-nowrap transition-[background-color,color] duration-150 ease-out motion-reduce:transition-none",
        focusRing,
        compact ? "min-h-10 px-3.5 text-sm" : "min-h-11 px-3 text-sm",
        active
          ? "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-off-white)] hover:text-[var(--color-neutral-charcoal)]",
      )}
    >
      <Icon
        aria-hidden
        className={cn("size-4 shrink-0", compact && "hidden sm:block")}
      />
      {children}
    </Link>
  );
}
