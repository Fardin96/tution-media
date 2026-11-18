import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { AdminRefundDetailPage } from "@/components/admin/refund-detail-page";

export const metadata: Metadata = { title: "Refund · Masters Hub" };

export default async function AdminRefundRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  const { id } = await params;
  return <AdminRefundDetailPage id={id} />;
}
