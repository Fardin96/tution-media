import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { TutorRequirementsPage } from "@/components/tutor-requirements/tutor-requirements-page";

export const metadata: Metadata = { title: "Requirement sets · Masters Hub" };

export default async function TutorRequirementsRoute() {
  const user = await requireSession();
  if (user.role !== "TUTOR") redirect("/dashboard");

  return (
    <Suspense>
      <TutorRequirementsPage />
    </Suspense>
  );
}
