import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { BlogEditorPage } from "@/components/admin/blog-editor";

export const metadata: Metadata = { title: "New post · Masters Hub" };

export default async function AdminNewBlogPostRoute() {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  return <BlogEditorPage />;
}
