import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { BlogEditorPage } from "@/components/admin/blog-editor";

export const metadata: Metadata = { title: "Edit post · Masters Hub" };

export default async function AdminBlogPostRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")
    redirect("/dashboard");

  const { id } = await params;
  return <BlogEditorPage id={id} />;
}
