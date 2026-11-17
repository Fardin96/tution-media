import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminFeesPage } from "@/components/admin/fees-page";

export const metadata: Metadata = { title: "Fees · Masters Hub" };

export default async function AdminFeesRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminFeesPage />
    </Suspense>
  );
}
