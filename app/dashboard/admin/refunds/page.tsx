import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminRefundsPage } from "@/components/admin/refunds-page";

export const metadata: Metadata = { title: "Refunds · Masters Hub" };

export default async function AdminRefundsRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminRefundsPage />
    </Suspense>
  );
}
