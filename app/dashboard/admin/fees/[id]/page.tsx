import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { AdminFeeDetailPage } from "@/components/admin/fee-detail-page";

export const metadata: Metadata = { title: "Fee · Masters Hub" };

export default async function AdminFeeRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  const { id } = await params;
  return <AdminFeeDetailPage id={id} />;
}
