import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminVideosPage } from "@/components/admin/videos-page";

export const metadata: Metadata = { title: "Videos · Masters Hub" };

export default async function AdminVideosRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminVideosPage />
    </Suspense>
  );
}
