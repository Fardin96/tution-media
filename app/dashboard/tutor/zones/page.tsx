import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { TutorZonesPage } from "@/components/tutor-zones/tutor-zones-page";

export const metadata: Metadata = { title: "Teaching zones · Masters Hub" };

export default async function TutorZonesRoute() {
  const user = await requireSession();
  if (user.role !== "TUTOR") redirect("/dashboard");

  return <TutorZonesPage />;
}
