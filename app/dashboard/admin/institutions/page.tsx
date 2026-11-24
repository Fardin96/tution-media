import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { InstitutionsPage } from "@/components/admin/institutions-page";

export const metadata: Metadata = {
  title: "Schools and universities · Masters Hub",
};

export default async function AdminInstitutionsRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <InstitutionsPage />
    </Suspense>
  );
}
