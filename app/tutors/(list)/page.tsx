import { Suspense } from "react";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth.server";
import { BackToTop } from "@/components/back-to-top";
import { HeaderLink, PageFrame } from "@/components/ui/page-frame";
import { PublicTutorsPage } from "@/components/browse/public-tutors-page";
import { TutorCardsSkeleton } from "@/components/browse/find-tutors-page";

export const metadata: Metadata = {
  title: "Find tutors · Masters Hub",
  description:
    "Find tutors by subject, area and gender, or see the newest tutors. Sign in to see full profiles.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Public list outside the (site) group, with the same slim frame as the tutor profile page.
// It sits in the (list) route group so its loading.tsx does not wrap /tutors/[id].
export default async function PublicTutorsRoute({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const [signedIn, params] = await Promise.all([
    getSession().then((session) => session !== null),
    searchParams,
  ]);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  const qs = query.toString();
  const signInHref = `/sign-in?next=${encodeURIComponent(`/tutors${qs ? `?${qs}` : ""}`)}`;
  return (
    <>
      <PageFrame
        signedIn={signedIn}
        headerAction={
          signedIn ? undefined : (
            <HeaderLink href={signInHref}>Sign in</HeaderLink>
          )
        }
      >
        <Suspense fallback={<TutorCardsSkeleton label="Loading tutors…" />}>
          <PublicTutorsPage signedIn={signedIn} />
        </Suspense>
      </PageFrame>
      <BackToTop />
    </>
  );
}
