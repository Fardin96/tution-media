import { RequirementShellSkeleton } from "@/components/requirements/requirement-shell-skeleton";

// Covers the post-a-requirement form and the edit form (both RequirementPageShell), which have no
// loader of their own. The applicants list has its own loading.tsx.
export default function RequirementLoading() {
  return <RequirementShellSkeleton />;
}
