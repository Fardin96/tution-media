import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { MatchingPage } from "@/components/admin/matching-page";

export const metadata: Metadata = { title: "Matching · Masters Hub" };

export default async function AdminMatchingRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return (
    <Suspense>
      <MatchingPage />
    </Suspense>
  );
}
