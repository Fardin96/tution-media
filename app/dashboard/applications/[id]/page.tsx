import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { ApplicationDetailPage } from "@/components/applications/application-detail-page";

export const metadata: Metadata = { title: "Application · Masters Hub" };

export default async function ApplicationRoute({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireSession();
  // Admins get the read-only view; the component hides every action for them.
  const role =
    user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? "ADMIN" : user.role;
  if (role !== "TUTOR" && role !== "STUDENT" && role !== "ADMIN")
    redirect("/dashboard");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const from =
    query.from === "applicants" || query.from === "package-requests"
      ? query.from
      : undefined;
  const packageId =
    typeof query.package === "string" ? query.package : undefined;
  return (
    <ApplicationDetailPage
      id={id}
      role={role}
      from={from}
      packageId={packageId}
    />
  );
}
