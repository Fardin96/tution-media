import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { RequirementPageShell } from "@/components/requirements/requirement-page-shell";
import { PackageForm } from "@/components/packages/package-form";

export const metadata: Metadata = {
  title: "New package · Masters Hub",
};

export default async function NewPackagePage() {
  const session = await requireSession();
  if (session.role !== "TUTOR") {
    redirect("/dashboard");
  }

  return (
    <RequirementPageShell
      title="New package"
      description="Students near your zones can find it and request it. It goes live when you publish."
      back={{ href: "/dashboard/tutor/packages", label: "Packages" }}
      eyebrow="Package"
    >
      <PackageForm mode="create" />
    </RequirementPageShell>
  );
}
