import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { AdminDisputeDetailPage } from "@/components/admin/dispute-detail-page";

export const metadata: Metadata = { title: "Dispute · Masters Hub" };

export default async function AdminDisputeRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  const { id } = await params;
  return <AdminDisputeDetailPage id={id} />;
}
