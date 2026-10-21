"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { profileApi, profileOf } from "@/lib/profile";
import { cn } from "@/lib/utils";
import { GoogleIcon } from "./google-icon";
import type { UserRole } from "@/lib/api";

type AuthRole = Extract<UserRole, "STUDENT" | "TUTOR" | "ADMIN">;

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential: string }) => void;
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: Record<string, string | number>,
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

interface GoogleSignInButtonProps {
  clientId: string;
  mode: "sign-in" | "sign-up";
  role?: AuthRole;
  disabled?: boolean;
  onError?: (message: string) => void;
}

export const NO_ACCOUNT =
  "There's no Masters Hub account for this Google account yet.";

function decodeJwtPayload(jwt: string): { name?: string; picture?: string } {
  try {
    const b64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {};
  }
}

export function GoogleSignInButton({
  clientId,
  mode,
  role,
  disabled = false,
  onError,
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ready || !clientId || typeof window === "undefined" || !window.google)
      return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          // No role on sign-in: the API then refuses to create a new account.
          const res = await api.post("/api/v1/auth/google", {
            idToken: response.credential,
            role,
          });

          if (res.status === 404) {
            onError?.(NO_ACCOUNT);
            return;
          }
          if (!res.ok) {
            const err = await res.json().catch(() => ({ message: "" }));
            throw new Error(
              err.message || `Authentication failed (${res.status})`,
            );
          }

          const data = (await res.json()) as {
            accessToken: string;
            refreshToken: string;
            account: Record<string, unknown>;
          };

          api.setTokens({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });

          // The API account has no name/photo; Google's (already verified) ID token does.
          const google = decodeJwtPayload(response.credential);
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...data.account,
              name: google.name,
              picture: google.picture,
            }),
          });

          // First sign-in (no profile yet) goes to onboarding; the dashboard guards too.
          const me = await profileApi.me().catch(() => null);
          router.push(
            me && me.role !== "ADMIN" && !profileOf(me)
              ? "/onboarding"
              : "/dashboard",
          );
        } catch (err) {
          onError?.(err instanceof Error ? err.message : "Sign in failed");
        }
      },
    });

    // One Tap (prompt) is suppressed by Brave/FedCM and cooldowns; Google's rendered
    // button opens a real account-chooser popup on tap, so it's overlaid invisibly.
    if (overlayRef.current) {
      window.google.accounts.id.renderButton(overlayRef.current, {
        type: "standard",
        shape: "pill",
        size: "large",
        text: mode === "sign-up" ? "signup_with" : "continue_with",
        // Match page language; this button is the accessible one when active.
        locale: "en",
        width: Math.min(overlayRef.current.offsetWidth || 400, 400),
      });
    }
  }, [ready, clientId, role, mode, router, onError]);

  return (
    <div className="relative">
      <Script
        src="https://accounts.google.com/gsi/client?hl=en"
        strategy="afterInteractive"
        // onReady also fires on remount (e.g. after logout navigation), onLoad doesn't
        onReady={() => setReady(true)}
      />
      <div
        ref={overlayRef}
        className={cn(
          "absolute inset-0 z-10 flex items-center justify-center overflow-hidden rounded-full opacity-[0.01]",
          (!ready || disabled) && "pointer-events-none invisible",
        )}
      />
      <button
        type="button"
        aria-hidden={ready && !disabled}
        tabIndex={-1}
        disabled={!ready || disabled}
        className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-[var(--color-neutral-white)] px-6 text-base font-semibold text-[var(--color-neutral-charcoal)] shadow-[0_1px_2px_0_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.1)] transition-[background-color,box-shadow,scale] duration-150 ease-out hover:bg-[var(--color-neutral-off-white)] hover:shadow-[0_4px_12px_-2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon />
        {mode === "sign-up" ? "Sign up with Google" : "Continue with Google"}
      </button>
    </div>
  );
}
