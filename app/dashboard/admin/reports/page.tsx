import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminReportsPage } from "@/components/admin/reports-page";

export const metadata: Metadata = { title: "Reports · Masters Hub" };

export default async function AdminReportsRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminReportsPage />
    </Suspense>
  );
}
