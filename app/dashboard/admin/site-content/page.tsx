import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { SiteContentPage } from "@/components/admin/site-content-page";

export const metadata: Metadata = { title: "Site content · Masters Hub" };

export default async function AdminSiteContentRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <SiteContentPage />
    </Suspense>
  );
}
