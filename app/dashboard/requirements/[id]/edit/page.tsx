import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { EditRequirementView } from "@/components/requirements/edit-requirement-view";

export const metadata: Metadata = {
  title: "Edit requirement · Masters Hub",
};

export default async function EditRequirementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  if (session.role !== "STUDENT") {
    redirect("/dashboard");
  }

  const { id } = await params;
  return <EditRequirementView id={id} />;
}
