"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { secondaryButton } from "@/components/profile/styles";

const WASH = [
  "radial-gradient(60% 50% at 10% 0%, color-mix(in oklab, var(--color-primary-core) 16%, transparent), transparent 70%)",
  "radial-gradient(50% 40% at 95% 10%, color-mix(in oklab, var(--color-mesh-glow) 45%, transparent), transparent 70%)",
  "radial-gradient(40% 40% at 80% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

interface RequirementPageShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

export function RequirementPageShell({
  title,
  description,
  children,
}: RequirementPageShellProps) {
  return (
    <main
      className="relative isolate flex min-h-dvh flex-col bg-[var(--color-neutral-off-white)]"
      style={{ backgroundImage: WASH }}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6 sm:px-6">
        <Link href="/dashboard" aria-label="Masters Hub Home">
          <Image
            src="/assets/ic-demo/Icon-blue.png"
            alt="Masters Hub"
            width={860}
            height={220}
            priority
            className="h-10 w-auto sm:h-12"
          />
        </Link>
        <Link
          href="/dashboard"
          className={cn(secondaryButton, "min-h-10 px-4")}
        >
          <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          Back to dashboard
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12">
        <p className="text-sm font-semibold text-[var(--color-primary-core)]">
          Tuition requirement
        </p>
        <h1
          id="requirement-form-title"
          tabIndex={-1}
          className="mt-1 text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] outline-none sm:text-3xl"
        >
          {title}
        </h1>
        <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
          {description}
        </p>

        {children}
      </div>
    </main>
  );
}
