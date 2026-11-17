import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { AdminPackageDetailPage } from "@/components/admin/package-detail-page";

export const metadata: Metadata = { title: "Package review · Masters Hub" };

export default async function AdminPackageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  const { id } = await params;
  return <AdminPackageDetailPage id={id} />;
}
