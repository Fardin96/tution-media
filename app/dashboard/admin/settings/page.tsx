import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { SettingsPage } from "@/components/admin/settings-page";

export const metadata: Metadata = { title: "Settings · Masters Hub" };

export default async function AdminSettingsRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return <SettingsPage />;
}
