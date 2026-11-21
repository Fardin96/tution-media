import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminStoriesPage } from "@/components/admin/stories-page";

export const metadata: Metadata = { title: "Stories · Masters Hub" };

export default async function AdminStoriesRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminStoriesPage />
    </Suspense>
  );
}
