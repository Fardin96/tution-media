import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { AdminBlogPage } from "@/components/admin/blog-page";

export const metadata: Metadata = { title: "Blog · Masters Hub" };

export default async function AdminBlogRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return <AdminBlogPage />;
}
