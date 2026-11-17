import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { RequirementPageShell } from "@/components/requirements/requirement-page-shell";
import { EditTutorRequirementView } from "@/components/tutor-requirements/edit-tutor-requirement-view";

export const metadata: Metadata = {
  title: "Edit requirement set · Masters Hub",
};

export default async function EditTutorRequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (session.role !== "TUTOR") {
    redirect("/dashboard");
  }

  const { id } = await params;
  return (
    <RequirementPageShell
      title="Edit requirement set"
      description="Changes apply to packages that use this set."
      back={{
        href: "/dashboard/tutor/requirements",
        label: "Requirement sets",
      }}
      eyebrow="Requirement set"
    >
      <EditTutorRequirementView id={id} />
    </RequirementPageShell>
  );
}
