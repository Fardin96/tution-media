import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { AdminFilesPage } from "@/components/admin/files-page";

export const metadata: Metadata = { title: "Files · Masters Hub" };

export default async function AdminFilesRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return <AdminFilesPage />;
}
