"use client";

import { useState } from "react";
import { GraduationCap, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Role = "student" | "tutor" | null;

export function RoleDialog() {
  const [role, setRole] = useState<Role>(null);
  const [open, setOpen] = useState(true);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[oklch(0.2_0_0/0.35)] backdrop-blur-sm transition-opacity duration-200"
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-title"
        className="relative w-full max-w-sm overflow-hidden rounded-[24px] bg-[var(--color-neutral-white)] p-6 text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] sm:p-8"
      >
        {role === null ? (
          <>
            <h2
              id="role-title"
              className="text-xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] sm:text-2xl"
            >
              How do you want to use Masters Hub?
            </h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Choose the account type that fits you best.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <RoleOption
                icon={<GraduationCap className="size-6" />}
                label="Student"
                description="Find a tutor"
                onClick={() => setRole("student")}
              />
              <RoleOption
                icon={<Users className="size-6" />}
                label="Tutor"
                description="Offer lessons"
                onClick={() => setRole("tutor")}
              />
            </div>
          </>
        ) : (
          <div className="animate-in zoom-in-95 fade-in fill-mode-both duration-200">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--color-secondary-sky)] text-[var(--color-primary-core)]">
              {role === "student" ? (
                <GraduationCap className="size-7" />
              ) : (
                <Users className="size-7" />
              )}
            </div>
            <h2 className="mt-4 text-xl font-semibold text-[var(--color-neutral-charcoal)]">
              Signed in as {role === "student" ? "Student" : "Tutor"}
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              You can change this later in your profile.
            </p>
            <Button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-6 h-12 w-full rounded-full bg-[var(--color-primary-core)] text-base font-semibold text-white hover:bg-[var(--color-primary-hover)] active:scale-[0.96]"
            >
              Continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleOption({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-[16px] border border-[var(--color-neutral-border)] bg-[var(--color-neutral-off-white)] p-5 text-center transition-[border-color,background-color,scale] duration-150 ease-out hover:border-[var(--color-primary-core)] hover:bg-[color-mix(in_oklab,var(--color-secondary-sky)_30%,white)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-core)] active:scale-[0.96]",
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
