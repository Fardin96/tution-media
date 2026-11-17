import type { Metadata } from "next";
import { AccountDetailPage } from "@/components/admin/account-detail-page";

export const metadata: Metadata = { title: "Account · Masters Hub" };

export default async function AdminAccountRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AccountDetailPage id={id} />;
}
