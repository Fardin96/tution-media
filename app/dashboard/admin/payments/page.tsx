import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminPaymentsPage } from "@/components/admin/payments-page";

export const metadata: Metadata = { title: "Payments · Masters Hub" };

export default async function AdminPaymentsRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminPaymentsPage />
    </Suspense>
  );
}
