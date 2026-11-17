import type * as React from "react";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { AdminShell } from "@/components/admin/admin-shell";

// Every /dashboard/admin page is admin-only. The API still checks the admin row on each call.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");
  return <AdminShell>{children}</AdminShell>;
}
