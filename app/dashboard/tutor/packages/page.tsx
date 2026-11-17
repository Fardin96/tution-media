import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { MyPackagesPage } from "@/components/packages/my-packages-page";

export const metadata: Metadata = { title: "Packages · Masters Hub" };

export default async function TutorPackagesRoute() {
  const user = await requireSession();
  if (user.role !== "TUTOR") redirect("/dashboard");

  return <MyPackagesPage />;
}
