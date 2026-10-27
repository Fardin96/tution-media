"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Users } from "lucide-react";
import { toast } from "sonner";
import { AnimatedMeshGradientLayer } from "@/components/mesh-gradient/mesh-gradient-animated";
import { cn } from "@/lib/utils";
import { GoogleSignInButton, NO_ACCOUNT } from "./google-sign-in-button";
import type { UserRole } from "@/lib/api";

type AuthMode = "sign-in" | "sign-up";
type PublicRole = Extract<UserRole, "STUDENT" | "TUTOR">;

const COPY: Record<
  AuthMode,
  {
    title: string;
    description: string;
    switchText: string;
    switchLabel: string;
    switchHref: string;
  }
> = {
  "sign-in": {
    title: "Sign in",
    description: "Sign in with your Google account to continue.",
    switchText: "Don't have an account?",
    switchLabel: "Sign up",
    switchHref: "/sign-up",
  },
  "sign-up": {
    title: "Create your account",
    description: "Choose how you want to use Masters Hub, then sign up.",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/sign-in",
  },
};

export interface AuthSplitProps {
  mode: AuthMode;
  clientId: string;
  /** Override the default heading, e.g. "Admin sign in". */
  title?: string;
  description?: string;
  /** Hide the "Sign up / Sign in" switch link (admin has no public sign-up). */
  hideSwitch?: boolean;
  /** Fixed role sent to the backend (e.g. ADMIN). When omitted on sign-up the user picks Student/Tutor. */
  role?: Extract<UserRole, "STUDENT" | "TUTOR" | "ADMIN">;
}

// Soft brand-blue light wash; drifts via the hero's mesh animation layer.
const PANEL_WASH = [
  "radial-gradient(55% 45% at 18% 12%, color-mix(in oklab, var(--color-primary-core) 22%, transparent), transparent 70%)",
  "radial-gradient(50% 45% at 88% 85%, color-mix(in oklab, var(--color-mesh-glow) 55%, transparent), transparent 70%)",
  "radial-gradient(45% 40% at 80% 18%, var(--color-secondary-sky), transparent 70%)",
  "radial-gradient(40% 35% at 15% 90%, var(--color-secondary-sky), transparent 70%)",
].join(",");

const enter =
  "animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500 ease-out motion-reduce:animate-none";

/**
 * Split-screen auth layout: brand panel left, Google-only form right.
 * Below `lg` only the logo and tagline sit above the form, no background.
 */
export function AuthSplit({
  mode,
  clientId,
  title,
  description,
  hideSwitch = false,
  role: fixedRole,
}: AuthSplitProps) {
  const copy = COPY[mode];
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<PublicRole | null>(null);
  const onError = useCallback(
    (message: string) =>
      toast.error(
        message,
        message === NO_ACCOUNT
          ? {
              action: {
                label: "Sign up",
                onClick: () => router.push("/sign-up"),
              },
            }
          : undefined,
      ),
    [router],
  );

  const showRolePicker = mode === "sign-up" && !fixedRole;
  const effectiveRole = fixedRole ?? selectedRole ?? undefined;
  const canSubmit = !showRolePicker || selectedRole !== null;

  return (
    <main className="flex min-h-dvh flex-col bg-[var(--color-neutral-white)] lg:grid lg:grid-cols-2">
      <BrandPanel />

      <div className="flex flex-1 flex-col px-6 pt-12 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-10 lg:pt-6">
        <div className="mx-auto flex w-full max-w-sm flex-col text-center lg:flex-1 lg:justify-center">
          <h1
            className={cn(
              enter,
              "text-3xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-4xl",
            )}
          >
            {title ?? copy.title}
          </h1>
          <p
            className={cn(
              enter,
              "mt-3 text-base text-pretty text-[var(--color-text-secondary)] delay-100",
            )}
          >
            {description ?? copy.description}
          </p>

          {showRolePicker && (
            <div
              className={cn(enter, "mt-8 grid gap-3 delay-150 sm:grid-cols-2")}
            >
              <RoleOption
                icon={<GraduationCap className="size-6" />}
                label="Student"
                description="Find a tutor"
                selected={selectedRole === "STUDENT"}
                onClick={() => setSelectedRole("STUDENT")}
              />
              <RoleOption
                icon={<Users className="size-6" />}
                label="Tutor"
                description="Offer lessons"
                selected={selectedRole === "TUTOR"}
                onClick={() => setSelectedRole("TUTOR")}
              />
            </div>
          )}

          <div className={cn(enter, "mt-8 delay-200")}>
            <GoogleSignInButton
              clientId={clientId}
              mode={mode}
              role={effectiveRole}
              disabled={!canSubmit}
              onError={onError}
            />
          </div>

          {canSubmit === false && (
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Pick a role above to continue.
            </p>
          )}

          {!hideSwitch && (
            <p
              className={cn(
                enter,
                "mt-8 text-sm text-[var(--color-text-secondary)] delay-300",
              )}
            >
              {copy.switchText}{" "}
              <Link
                href={copy.switchHref}
                className="rounded-sm font-semibold text-[var(--color-primary-core)] underline-offset-4 transition-colors duration-150 hover:text-[var(--color-primary-hover)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)]"
              >
                {copy.switchLabel}
              </Link>
            </p>
          )}
        </div>

        <p className="mt-auto pt-10 text-center text-xs text-[var(--color-text-secondary)]">
          © Masters Hub ·{" "}
          <Link href="/privacy" className="hover:underline">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="hover:underline">
            Terms
          </Link>
        </p>
      </div>
    </main>
  );
}

function BrandPanel() {
  return (
    <div className="relative isolate flex flex-1 items-end justify-center overflow-hidden pt-16 lg:min-h-dvh lg:items-center lg:bg-[var(--color-neutral-off-white)] lg:pt-0">
      {/* Background is desktop-only; mobile shows just the logo and tagline. */}
      <div className="absolute inset-0 -z-10 max-lg:hidden">
        <AnimatedMeshGradientLayer>
          <div
            className="absolute inset-0"
            style={{ background: PANEL_WASH }}
          />
        </AnimatedMeshGradientLayer>
      </div>

      {/* Concentric rings, a light nod to the reference's torus shader. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center [mask-image:radial-gradient(closest-side,black_40%,transparent)] max-lg:hidden"
      >
        {[280, 440, 600, 760].map((size) => (
          <span
            key={size}
            className="absolute rounded-full border border-[color-mix(in_oklab,var(--color-primary-core)_14%,transparent)]"
            style={{ width: size, height: size }}
          />
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 px-6 text-center lg:gap-5">
        <Link
          href="/"
          className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary-core)]"
        >
          <Image
            src="/assets/ic-demo/Icon-blue.png"
            alt="Masters Hub"
            width={860}
            height={220}
            priority
            className="h-14 w-auto sm:h-16"
          />
        </Link>
        <p className="max-w-xs text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
          Find the right tutor, faster.
        </p>
      </div>
    </div>
  );
}

function RoleOption({
  icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-2 rounded-[16px] border bg-[var(--color-neutral-off-white)] p-5 text-center transition-[border-color,background-color,scale] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)] active:scale-[0.96]",
        selected
          ? "border-[var(--color-primary-core)] bg-[color-mix(in_oklab,var(--color-secondary-sky)_30%,white)]"
          : "border-[var(--color-neutral-border)] hover:border-[var(--color-primary-core)] hover:bg-[color-mix(in_oklab,var(--color-secondary-sky)_30%,white)]",
      )}
    >
      <span className="text-[var(--color-primary-core)]">{icon}</span>
      <span className="font-semibold text-[var(--color-neutral-charcoal)]">
        {label}
      </span>
      <span className="text-xs text-[var(--color-text-secondary)]">
        {description}
      </span>
    </button>
  );
}
