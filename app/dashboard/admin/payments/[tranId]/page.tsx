import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { AdminPaymentDetailPage } from "@/components/admin/payment-detail-page";

export const metadata: Metadata = { title: "Payment · Masters Hub" };

export default async function AdminPaymentRoute({
  params,
}: {
  params: Promise<{ tranId: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  const { tranId } = await params;
  return <AdminPaymentDetailPage tranId={tranId} />;
}
