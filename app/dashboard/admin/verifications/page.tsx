import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminVerificationsPage } from "@/components/admin/verifications-page";

export const metadata: Metadata = { title: "Verifications · Masters Hub" };

export default async function AdminVerificationsRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminVerificationsPage />
    </Suspense>
  );
}
