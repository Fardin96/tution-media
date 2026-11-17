import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminApplicationsPage } from "@/components/admin/applications-page";

export const metadata: Metadata = { title: "Applications · Masters Hub" };

export default async function AdminApplicationsRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminApplicationsPage />
    </Suspense>
  );
}
