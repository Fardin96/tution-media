import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { AdminReviewsPage } from "@/components/admin/reviews-page";

export const metadata: Metadata = { title: "Reviews · Masters Hub" };

export default async function AdminReviewsRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <AdminReviewsPage />
    </Suspense>
  );
}
