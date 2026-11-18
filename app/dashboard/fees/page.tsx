import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { FeesPage } from "@/components/fees/fees-page";

export const metadata: Metadata = { title: "Placement fees · Masters Hub" };

export default async function FeesRoute() {
  const user = await requireSession();
  if (user.role !== "TUTOR") redirect("/dashboard");

  return <FeesPage />;
}
