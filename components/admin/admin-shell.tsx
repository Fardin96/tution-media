"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Clapperboard,
  Flag,
  CreditCard,
  FileText,
  HardDrive,
  IdCard,
  LayoutGrid,
  LayoutTemplate,
  LogOut,
  Menu,
  MapPin,
  X,
  Newspaper,
  MessageSquareQuote,
  MessageSquareWarning,
  Package,
  ScrollText,
  Star,
  Settings,
  ShieldCheck,
  TicketPercent,
  Undo2,
  Users,
  Wallet,
  Waypoints,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminMe } from "@/lib/admin";
import { card, focusRing } from "@/components/profile/styles";
import {
  LogoutButton,
  logoutTriggerClass,
} from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export const ADMIN_NAV = [
  {
    href: "/dashboard/admin",
    label: "Dashboard",
    icon: LayoutGrid,
    description: "Where the business is stuck, and the numbers that matter.",
  },
  {
    href: "/dashboard/admin/packages",
    label: "Packages",
    icon: Package,
    description: "Approve new packages before students can see them.",
  },
  {
    href: "/dashboard/admin/verifications",
    label: "Verifications",
    icon: IdCard,
    description: "Check ID documents from tutors and students.",
  },
  {
    href: "/dashboard/admin/videos",
    label: "Videos",
    icon: Clapperboard,
    description: "Approve teaching videos before they go public.",
  },
  {
    href: "/dashboard/admin/reviews",
    label: "Reviews",
    icon: Star,
    description: "Hide or restore ratings and comments.",
  },
  {
    href: "/dashboard/admin/stories",
    label: "Stories",
    icon: MessageSquareQuote,
    description: "Approve student and tutor stories for the home page.",
  },
  {
    href: "/dashboard/admin/reports",
    label: "Reports",
    icon: Flag,
    description:
      "Reports about people. Take a case, then resolve or dismiss it.",
  },
  {
    href: "/dashboard/admin/disputes",
    label: "Disputes",
    icon: MessageSquareWarning,
    description: "Problems with a tuition that need an admin to step in.",
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
    href: "/dashboard/admin/payments",
    label: "Payments",
    icon: CreditCard,
    description: "Online payments, and the ones that need a decision.",
  },
  {
    href: "/dashboard/admin/promo-codes",
    label: "Promo codes",
    icon: TicketPercent,
    description: "Discount codes tutors can use on their fees.",
  },
  {
    href: "/dashboard/admin/refunds",
    label: "Refunds",
    icon: Undo2,
    description: "Tutor refund requests and refunds in progress.",
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
    href: "/dashboard/admin/areas",
    label: "Areas",
    icon: MapPin,
    description: "Add, rename or retire the areas people pick.",
  },
  {
    href: "/dashboard/admin/blog",
    label: "Blog",
    icon: Newspaper,
    description: "Write, publish and archive blog posts.",
  },
  {
    href: "/dashboard/admin/site-content",
    label: "Site content",
    icon: LayoutTemplate,
    description:
      "Edit the landing page and the About, Terms, Privacy and Contact pages.",
  },
  {
    href: "/dashboard/admin/files",
    label: "Files",
    icon: HardDrive,
    description: "Uploaded files, storage use and leftovers.",
  },
  {
    href: "/dashboard/admin/settings",
    label: "Settings",
    icon: Settings,
    description: "Commission and the verification switches.",
  },
  {
    href: "/dashboard/admin/matching",
    label: "Matching",
    icon: Waypoints,
    description: "Which tutors match which tuitions, and the city areas.",
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

/** Admin chrome: sidebar on wide screens, a top bar with a menu drawer on narrow ones, and the approval gate. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const me = useAdminMe();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  // Adjusting state during render (not in an effect) closes the drawer on every navigation.
  if (pathname !== menuPath) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  // The sidebar takes over at lg, so a drawer left open would sit on top of it.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const closeIfWide = () => {
      if (wide.matches) setMenuOpen(false);
    };
    wide.addEventListener("change", closeIfWide);
    return () => wide.removeEventListener("change", closeIfWide);
  }, []);

  // Focus returns to the menu button when the logout dialog closes, since the drawer that held the trigger is gone.
  const onLogoutOpenChange = (open: boolean) => {
    setLogoutOpen(open);
    // A frame later: the dialog's focus trap is still active until this close commits.
    if (!open)
      requestAnimationFrame(() => {
        // The menu button is display: none at lg. Focusing it there would drop focus to the body.
        const button = menuButton.current;
        if (button?.getClientRects().length) button.focus();
        else
          document
            .querySelector<HTMLElement>("aside [data-home-link]")
            ?.focus();
      });
  };

  const currentLabel =
    ADMIN_NAV.find((item) => isActive(pathname, item.href))?.label ?? "Admin";

  return (
    <div className="min-h-dvh bg-[var(--color-neutral-off-white)] lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:border-e lg:border-[var(--color-neutral-border)] lg:bg-[var(--color-neutral-white)] lg:px-4 lg:py-6">
        <Link
          href="/dashboard/admin"
          aria-label="Admin overview"
          data-home-link
          className="px-3"
        >
          <Image
            src="/assets/ic-demo/Icon-blue.png"
            alt="Masters Hub"
            width={860}
            height={220}
            preload
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
          <AdminIdentity adminUser={me.adminUser} />
          <LogoutButton className="h-11 text-sm" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--color-neutral-border)] bg-[color-mix(in_oklab,var(--color-neutral-white)_92%,transparent)] px-2 backdrop-blur lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <button
                ref={menuButton}
                type="button"
                aria-label="Open admin menu"
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-full text-[var(--color-neutral-charcoal)] transition-colors duration-150 ease-out hover:bg-[var(--color-neutral-off-white)] motion-reduce:transition-none",
                  focusRing,
                )}
              >
                <Menu aria-hidden className="size-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              onCloseAutoFocus={(event) => {
                // The logout dialog takes focus; the drawer must not pull it back.
                if (logoutOpen) event.preventDefault();
              }}
              showCloseButton={false}
              className="data-[side=left]:w-[min(20rem,85vw)] motion-reduce:animate-none"
            >
              <div className="flex h-14 items-center justify-between px-6">
                <SheetTitle className="text-sm font-semibold text-[var(--color-neutral-charcoal)]">
                  Admin menu
                </SheetTitle>
                <SheetClose asChild>
                  <button
                    type="button"
                    aria-label="Close admin menu"
                    className={cn(
                      "grid size-11 place-items-center rounded-full text-[var(--color-neutral-charcoal)] transition-colors duration-150 ease-out hover:bg-[var(--color-neutral-off-white)] motion-reduce:transition-none",
                      focusRing,
                    )}
                  >
                    <X aria-hidden className="size-5" />
                  </button>
                </SheetClose>
              </div>
              <SheetDescription className="sr-only">
                Every admin page.
              </SheetDescription>
              <MobileNav
                pathname={pathname}
                onNavigate={() => setMenuOpen(false)}
              />
              <div className="grid gap-3 border-t border-[var(--color-neutral-border)] px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <AdminIdentity adminUser={me.adminUser} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMenuOpen(false);
                    setLogoutOpen(true);
                  }}
                  className={logoutTriggerClass}
                >
                  <LogOut className="size-4" />
                  Log out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
          <Link
            href="/dashboard/admin"
            aria-label="Admin overview"
            data-home-link
            className="shrink-0"
          >
            <Image
              src="/assets/ic-demo/Icon-blue.png"
              alt="Masters Hub"
              width={860}
              height={220}
              preload
              className="h-8 w-auto"
            />
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--color-neutral-charcoal)]">
            {currentLabel}
          </p>
        </header>
        {/* Renders only the dialog and overlay; the drawer's button opens it. */}
        <LogoutButton
          hideTrigger
          open={logoutOpen}
          onOpenChange={onLogoutOpenChange}
        />

        <main
          className={cn(
            "mx-auto w-full flex-1",
            pathname === "/dashboard/admin" ? "max-w-7xl" : "max-w-5xl",
            "px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10",
          )}
        >
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

function AdminIdentity({
  adminUser,
}: {
  adminUser: ReturnType<typeof useAdminMe>["adminUser"];
}) {
  if (!adminUser) return null;
  return (
    <div className="min-w-0 px-3">
      <p className="truncate text-sm font-semibold text-[var(--color-neutral-charcoal)]">
        {adminUser.name}
      </p>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {adminUser.adminRole === "SUPER_ADMIN" ? "Super admin" : "Admin"}
      </p>
    </div>
  );
}

// Mounted only while the drawer is open, so the effect runs on each open.
function MobileNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  const navRef = useRef<HTMLElement>(null);

  // Brings the current page into view.
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Admin"
      className="flex-1 overflow-y-auto overscroll-contain px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <ul className="grid gap-1">
        {ADMIN_NAV.map((item) => (
          <li key={item.href}>
            <NavLink
              href={item.href}
              active={isActive(pathname, item.href)}
              icon={item.icon}
              onNavigate={onNavigate}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavLink({
  href,
  active,
  icon: Icon,
  onNavigate,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  // Runs on every click, including a link to the current page, which doesn't change the pathname.
  onNavigate?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-[background-color,color] duration-150 ease-out motion-reduce:transition-none",
        focusRing,
        active
          ? "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-off-white)] hover:text-[var(--color-neutral-charcoal)]",
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {children}
    </Link>
  );
}
