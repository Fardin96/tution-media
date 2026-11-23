import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AdminDashboard,
  DashboardSkeleton,
} from "@/components/admin/dashboard/admin-dashboard";

export const metadata: Metadata = {
  title: "Dashboard · Admin · Masters Hub",
};

export default function AdminDashboardRoute() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AdminDashboard />
    </Suspense>
  );
}
