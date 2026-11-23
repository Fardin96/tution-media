import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { safeNext } from "@/lib/safe-next";
import { OnboardingWizard } from "@/components/profile/onboarding-wizard";

export const metadata: Metadata = {
  title: "Set up your profile · Masters Hub",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSession();
  if (user.role !== "STUDENT" && user.role !== "TUTOR") redirect("/dashboard");
  const { next } = await searchParams;
  return (
    <OnboardingWizard
      role={user.role}
      defaultName={user.name}
      next={safeNext(next) ?? undefined}
    />
  );
}
