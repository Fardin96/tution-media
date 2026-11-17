import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { SubjectsPage } from "@/components/admin/subjects-page";

export const metadata: Metadata = { title: "Subjects · Masters Hub" };

export default async function AdminSubjectsRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return <SubjectsPage />;
}
