import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminPromoCodesPage } from "@/components/admin/promo-codes-page";

export const metadata: Metadata = { title: "Promo codes · Masters Hub" };

export default async function AdminPromoCodesRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminPromoCodesPage />
    </Suspense>
  );
}
