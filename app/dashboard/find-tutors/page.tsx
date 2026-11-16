import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { FindTutorsPage } from "@/components/browse/find-tutors-page";

export const metadata: Metadata = { title: "Find tutors · Masters Hub" };

export default async function FindTutorsRoute() {
  const user = await requireSession();
  if (user.role !== "STUDENT") redirect("/dashboard");

  return (
    <Suspense>
      <FindTutorsPage />
    </Suspense>
  );
}
