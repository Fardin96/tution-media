import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { ReportsPage } from "@/components/cases/reports-page";

export const metadata: Metadata = {
  title: "Reports and disputes · Masters Hub",
};

export default async function ReportsRoute() {
  const user = await requireSession();
  if (user.role !== "STUDENT" && user.role !== "TUTOR") redirect("/dashboard");

  return <ReportsPage />;
}
