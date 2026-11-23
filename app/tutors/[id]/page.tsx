import { cache } from "react";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth.server";
import { publicApiGet, type PublicGetResult } from "@/lib/server-fetch";
import type { PublicTutor } from "@/lib/tutor-profile";
import { BackToTop } from "@/components/back-to-top";
import { HeaderLink, PageFrame } from "@/components/ui/page-frame";
import { TutorProfilePage } from "@/components/tutor-profile/tutor-profile-page";

type Params = { params: Promise<{ id: string }> };

// The anonymous public profile. No cookie or Authorization is sent, so the result is the same for
// every visitor and can be cached. Unlisted tutors answer 404 here; the client query then runs with
// the viewer's token, so an owner still sees their own unlisted profile. cache() makes
// generateMetadata and the page share one request per render.
const loadPublicTutor = cache(
  (id: string): Promise<PublicGetResult<{ tutor: PublicTutor }>> =>
    publicApiGet<{ tutor: PublicTutor }>(
      `/api/v1/tutors/${encodeURIComponent(id)}`,
      { revalidate: 60, tags: ["tutors", `tutor:${id}`] },
    ),
);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const result = await loadPublicTutor(id);
  return {
    title: result.ok
      ? `${result.data.tutor.name} · Masters Hub`
      : "Tutor · Masters Hub",
  };
}

// Public page outside the (site) group: the same slim frame for everyone, with no marketing navbar or footer.
export default async function TutorPage({ params }: Params) {
  const { id } = await params;
  const [session, profile] = await Promise.all([
    getSession(),
    loadPublicTutor(id),
  ]);
  const signedIn = session !== null;
  return (
    <>
      <PageFrame
        signedIn={signedIn}
        headerAction={
          signedIn ? undefined : (
            <HeaderLink href="/sign-in">Sign in</HeaderLink>
          )
        }
      >
        <TutorProfilePage
          id={id}
          // Only a 200 body is passed on. Any other status leaves the client query to load the profile.
          initialProfile={profile.ok ? profile.data.tutor : undefined}
          signedIn={signedIn}
        />
      </PageFrame>
      <BackToTop />
    </>
  );
}
