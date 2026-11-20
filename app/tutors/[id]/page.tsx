import { getSession } from "@/lib/auth.server";
import { HeaderLink, PageFrame } from "@/components/ui/page-frame";
import { TutorProfilePage } from "@/components/tutor-profile/tutor-profile-page";

export const metadata = { title: "Tutor · Masters Hub" };

// Public page outside the (site) group: the same slim frame for everyone, with no marketing navbar or footer.
export default async function TutorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const signedIn = (await getSession()) !== null;
  return (
    <PageFrame
      signedIn={signedIn}
      headerAction={
        signedIn ? undefined : <HeaderLink href="/sign-in">Sign in</HeaderLink>
      }
    >
      <TutorProfilePage id={id} />
    </PageFrame>
  );
}
