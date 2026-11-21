import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth.server";
import { RequirementPageShell } from "@/components/requirements/requirement-page-shell";
import { RequirementForm } from "@/components/requirements/requirement-form";
import { PostAgainView } from "@/components/requirements/post-again-view";

export const metadata: Metadata = {
  title: "Post a requirement · Masters Hub",
};

export default async function NewRequirementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const session = await requireSession();
  if (session.role !== "STUDENT") {
    redirect("/dashboard");
  }

  const { from } = await searchParams;
  const fromId = typeof from === "string" && from.length > 0 ? from : null;

  if (fromId) {
    return (
      <RequirementPageShell
        title="Post again"
        description="We copied your earlier requirement. Check the details, then post."
      >
        <PostAgainView fromId={fromId} />
      </RequirementPageShell>
    );
  }

  return (
    <RequirementPageShell
      title="Post a requirement"
      description="Tutors who match will apply. You choose who to hire."
    >
      <RequirementForm />
    </RequirementPageShell>
  );
}
