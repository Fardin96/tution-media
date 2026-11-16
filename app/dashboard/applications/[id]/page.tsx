import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { ApplicationDetailPage } from "@/components/applications/application-detail-page";

export const metadata: Metadata = { title: "Application · Masters Hub" };

export default async function ApplicationRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "TUTOR" && user.role !== "STUDENT") redirect("/dashboard");

  const { id } = await params;
  return <ApplicationDetailPage id={id} role={user.role} />;
}
