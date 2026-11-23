import { PageFrameSkeleton } from "@/components/ui/page-frame-skeleton";
import { TutorCardsSkeleton } from "@/components/browse/find-tutors-page";

// Shown at once on navigation, while page.tsx checks the session. Same chrome as the page's PageFrame.
// data-list-loading marks this boundary so the e2e test can catch it showing on a profile navigation.
export default function Loading() {
  return (
    <PageFrameSkeleton>
      <div data-list-loading className="contents">
        <div className="grid gap-6">
          <TutorCardsSkeleton />
        </div>
      </div>
    </PageFrameSkeleton>
  );
}
