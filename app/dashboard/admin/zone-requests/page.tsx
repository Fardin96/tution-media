import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { ZoneRequestsPage } from "@/components/admin/zone-requests-page";

export const metadata: Metadata = { title: "Zone requests · Masters Hub" };

export default async function AdminZoneRequestsRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <ZoneRequestsPage />
    </Suspense>
  );
}
