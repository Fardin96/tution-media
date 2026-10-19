import Image from "next/image";
import Link from "next/link";
import { buildGoogleAuthUrl } from "@/lib/auth";
import { AnimatedMeshGradientLayer } from "@/components/mesh-gradient/mesh-gradient-animated";
import { cn } from "@/lib/utils";

type AuthMode = "sign-in" | "sign-up";

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
    description: "Sign up with your Google account to continue.",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/sign-in",
  },
};

export interface AuthSplitProps {
  mode: AuthMode;
  /** Override the default heading, e.g. "Admin sign in". */
  title?: string;
  description?: string;
  /** Hide the "Sign up / Sign in" switch link (admin has no public sign-up). */
  hideSwitch?: boolean;
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
  title,
  description,
  hideSwitch = false,
}: AuthSplitProps) {
  const copy = COPY[mode];

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

          <div className={cn(enter, "mt-8 delay-200")}>
            <a
              href={buildGoogleAuthUrl()}
              className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-[var(--color-neutral-white)] px-6 text-base font-semibold text-[var(--color-neutral-charcoal)] shadow-[0_1px_2px_0_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.1)] transition-[background-color,box-shadow,scale] duration-150 ease-out hover:bg-[var(--color-neutral-off-white)] hover:shadow-[0_4px_12px_-2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)] active:scale-[0.96]"
            >
              <GoogleIcon />
              Continue with Google
            </a>
          </div>

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

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
