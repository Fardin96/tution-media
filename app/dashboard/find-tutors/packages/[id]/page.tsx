import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { PackageDetailPage } from "@/components/browse/package-detail-page";

export const metadata: Metadata = { title: "Package · Masters Hub" };

export default async function PackageRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "STUDENT") redirect("/dashboard");

  const { id } = await params;
  return <PackageDetailPage id={id} />;
}
