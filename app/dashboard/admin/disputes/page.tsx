import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminDisputesPage } from "@/components/admin/disputes-page";

export const metadata: Metadata = { title: "Disputes · Masters Hub" };

export default async function AdminDisputesRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminDisputesPage />
    </Suspense>
  );
}
