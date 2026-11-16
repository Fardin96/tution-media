import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { RequirementApplicantsPage } from "@/components/applications/requirement-applicants-page";

export const metadata: Metadata = { title: "Applicants · Masters Hub" };

export default async function RequirementApplicantsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "STUDENT") redirect("/dashboard");

  const { id } = await params;
  return <RequirementApplicantsPage requirementId={id} />;
}
