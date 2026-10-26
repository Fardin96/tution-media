import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { RequirementPageShell } from "@/components/requirements/requirement-page-shell";
import { RequirementForm } from "@/components/requirements/requirement-form";

export const metadata: Metadata = {
  title: "Post a requirement · Masters Hub",
};

export default async function NewRequirementPage() {
  const session = await requireSession();
  if (session.role !== "STUDENT") {
    redirect("/dashboard");
  }

  return (
    <RequirementPageShell
      title="Post a requirement"
      description="Tutors who match will apply. You choose who to hire."
    >
      <RequirementForm />
    </RequirementPageShell>
  );
}
