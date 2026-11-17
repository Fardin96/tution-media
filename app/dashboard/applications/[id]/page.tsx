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
  if (user.role !== "TUTOR" && user.role !== "STUDENT") redirect("/dashboard");

  const [{ id }, query] = await Promise.all([params, searchParams]);
  const from = query.from === "applicants" ? "applicants" : undefined;
  return <ApplicationDetailPage id={id} role={user.role} from={from} />;
}
