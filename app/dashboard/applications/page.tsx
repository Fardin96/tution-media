import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireSession } from "@/lib/auth.server";
import { ApplicationsPage } from "@/components/applications/applications-page";

export const metadata: Metadata = { title: "Applications · Masters Hub" };

export default async function ApplicationsRoute() {
  const user = await requireSession();
  if (user.role !== "TUTOR" && user.role !== "STUDENT") redirect("/dashboard");

  return (
    <Suspense>
      <ApplicationsPage role={user.role} />
    </Suspense>
  );
}
