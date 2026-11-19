import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { AdminReportDetailPage } from "@/components/admin/report-detail-page";

export const metadata: Metadata = { title: "Report · Masters Hub" };

export default async function AdminReportRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  const { id } = await params;
  return <AdminReportDetailPage id={id} />;
}
