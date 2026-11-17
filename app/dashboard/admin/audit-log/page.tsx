import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AuditLogPage } from "@/components/admin/audit-log-page";

export const metadata: Metadata = { title: "Audit log · Masters Hub" };

export default async function AdminAuditLogRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AuditLogPage />
    </Suspense>
  );
}
