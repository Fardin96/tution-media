import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { AdminPromoCodeDetailPage } from "@/components/admin/promo-code-detail-page";

export const metadata: Metadata = { title: "Promo code · Masters Hub" };

export default async function AdminPromoCodeRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  const { id } = await params;
  return <AdminPromoCodeDetailPage id={id} />;
}
