"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
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
      prompt: () => void;
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

export function GoogleSignInButton({
  clientId,
  mode,
  role,
  disabled = false,
  onError,
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !clientId || typeof window === "undefined" || !window.google)
      return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          const authRole = role ?? "STUDENT";
          const res = await api.post("/api/v1/auth/google", {
            idToken: response.credential,
            role: authRole,
          });

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

          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data.account),
          });

          router.push("/dashboard");
        } catch (err) {
          onError?.(err instanceof Error ? err.message : "Sign in failed");
        }
      },
    });
  }, [ready, clientId, role, router, onError]);

  const handleClick = () => {
    if (!ready || !window.google) return;
    window.google.accounts.id.prompt();
  };

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={!ready || disabled}
        className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-full bg-[var(--color-neutral-white)] px-6 text-base font-semibold text-[var(--color-neutral-charcoal)] shadow-[0_1px_2px_0_rgb(0_0_0/0.06),0_0_0_1px_rgb(0_0_0/0.1)] transition-[background-color,box-shadow,scale] duration-150 ease-out hover:bg-[var(--color-neutral-off-white)] hover:shadow-[0_4px_12px_-2px_rgb(0_0_0/0.08),0_0_0_1px_rgb(0_0_0/0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon />
        {mode === "sign-up" ? "Sign up with Google" : "Continue with Google"}
      </button>
    </>
  );
}
