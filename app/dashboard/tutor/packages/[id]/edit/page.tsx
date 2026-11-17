import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { RequirementPageShell } from "@/components/requirements/requirement-page-shell";
import { EditPackageView } from "@/components/packages/edit-package-view";

export const metadata: Metadata = {
  title: "Edit package · Masters Hub",
};

export default async function EditPackagePage({
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
      title="Edit package"
      description="Students with a pending or confirmed request are told about the change."
      back={{ href: "/dashboard/tutor/packages", label: "Packages" }}
      eyebrow="Package"
    >
      <EditPackageView id={id} />
    </RequirementPageShell>
  );
}
