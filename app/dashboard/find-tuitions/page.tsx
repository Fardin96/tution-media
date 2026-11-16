import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { FindTuitionsPage } from "@/components/browse/find-tuitions-page";

export const metadata: Metadata = { title: "Find tuitions · Masters Hub" };

export default async function FindTuitionsRoute() {
  const user = await requireSession();
  if (user.role !== "TUTOR") redirect("/dashboard");

  return (
    <Suspense>
      <FindTuitionsPage />
    </Suspense>
  );
}
