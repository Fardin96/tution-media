import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { FeeDetailPage } from "@/components/fees/fee-detail-page";

export const metadata: Metadata = { title: "Placement fee · Masters Hub" };

export default async function FeeRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "TUTOR") redirect("/dashboard");

  const { id } = await params;
  return <FeeDetailPage feeId={id} />;
}
