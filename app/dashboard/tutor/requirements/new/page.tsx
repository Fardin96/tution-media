import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { RequirementPageShell } from "@/components/requirements/requirement-page-shell";
import { TutorRequirementForm } from "@/components/tutor-requirements/tutor-requirement-form";

export const metadata: Metadata = {
  title: "New requirement set · Masters Hub",
};

export default async function NewTutorRequirementPage() {
  const session = await requireSession();
  if (session.role !== "TUTOR") {
    redirect("/dashboard");
  }

  return (
    <RequirementPageShell
      title="New requirement set"
      description="Students who match these can find you for tuitions."
      back={{
        href: "/dashboard/tutor/requirements",
        label: "Requirement sets",
      }}
      eyebrow="Requirement set"
    >
      <TutorRequirementForm />
    </RequirementPageShell>
  );
}
