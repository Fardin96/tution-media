"use client";

import { useTransition } from "react";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth.server";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  const handleLogout = async () => {
    const tokens = api.getTokens();
    if (tokens?.refreshToken) {
      try {
        await api.post("/api/v1/auth/logout", {
          refreshToken: tokens.refreshToken,
        });
      } catch {
        // Best-effort revocation: still clear local state on failure.
      }
    }
    api.clearTokens();

    startTransition(() => {
      signOut();
    });
  };

  return (
    <Button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      variant="outline"
      className="h-12 w-full gap-2 rounded-full border-[var(--color-neutral-border)] text-base font-semibold text-[var(--color-neutral-charcoal)] hover:bg-[var(--color-neutral-off-white)] active:scale-[0.96]"
    >
      <LogOut className="size-4" />
      {isPending ? "Logging out..." : "Log out"}
    </Button>
  );
}
