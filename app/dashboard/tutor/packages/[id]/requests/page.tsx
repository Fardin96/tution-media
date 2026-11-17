import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { PackageRequestsPage } from "@/components/packages/package-requests-page";

export const metadata: Metadata = { title: "Package requests · Masters Hub" };

export default async function PackageRequestsRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "TUTOR") redirect("/dashboard");

  const { id } = await params;
  return <PackageRequestsPage packageId={id} />;
}
