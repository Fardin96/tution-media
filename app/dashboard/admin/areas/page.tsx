import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { AreasPage } from "@/components/admin/areas-page";

export const metadata: Metadata = { title: "Areas · Masters Hub" };

export default async function AdminAreasRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return <AreasPage />;
}
