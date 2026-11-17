import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminPackagesPage } from "@/components/admin/packages-page";

export const metadata: Metadata = { title: "Packages · Masters Hub" };

export default async function AdminPackagesRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminPackagesPage />
    </Suspense>
  );
}
