import type { Metadata } from "next";
import { AdminOverview } from "@/components/admin/admin-overview";

export const metadata: Metadata = { title: "Admin · Masters Hub" };

export default function AdminOverviewRoute() {
  return <AdminOverview />;
}
