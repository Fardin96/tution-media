"use client";

import Link from "next/link";
import { BadgeCheck, GraduationCap, MapPin } from "lucide-react";
import {
  ErrorBlock,
  RatingInline,
  TutorInitial,
} from "@/components/browse/browse-ui";
import { TutorReviewList } from "@/components/reviews/review-list";
import {
  ProfileBack,
  useFallbackBack,
} from "@/components/tutor-profile/profile-back";
import { card, secondaryButton } from "@/components/profile/styles";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/profile";
import { useRefreshExpiredMedia } from "@/lib/files";
import {
  formatMemberSince,
  useTutorProfile,
  type PublicTutor,
  type PublicTutorVideo,
} from "@/lib/tutor-profile";
import { cn } from "@/lib/utils";

const CHIP =
  "rounded-full bg-[var(--color-secondary-sky)] px-3 py-1 text-sm font-medium text-[var(--color-primary-deep)]";
const SECTION_TITLE =
  "text-lg font-semibold tracking-tight text-[var(--color-neutral-charcoal)]";

export function TutorProfilePage({
  id,
  initialProfile,
  signedIn = false,
}: {
  id: string;
  /** The anonymous copy rendered on the server (app/tutors/[id]/page.tsx). */
  initialProfile?: PublicTutor;
  signedIn?: boolean;
}) {
  const query = useTutorProfile(id, { initialData: initialProfile, signedIn });
  const tutor = query.data;
  const notFound =
    query.error instanceof ApiError && query.error.status === 404;

  // PageFrame (app/tutors/[id]/page.tsx) provides <main>, the header and the page margins.
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {notFound ? (
        <TutorNotFound />
      ) : query.isError ? (
        <ErrorBlock
          message="Couldn't load this tutor profile."
          onRetry={() => void query.refetch()}
        />
      ) : query.isPending ? (
        <>
          <ProfileBack />
          <TutorProfileSkeleton />
        </>
      ) : tutor ? (
        <>
          <ProfileBack />
          <TutorDetails tutor={tutor} id={id} />
        </>
      ) : null}
    </div>
  );
}

/** The one back control on this page is the card's link, so the card does not add a second. */
function TutorNotFound() {
  const back = useFallbackBack();
  return (
    <section className={cn(card, "grid gap-3 p-6")}>
      <h1 className={SECTION_TITLE}>
        This tutor profile isn&apos;t available.
      </h1>
      <p className="text-pretty text-[var(--color-text-secondary)]">
        The tutor may have hidden their profile, or the link is wrong.
      </p>
      <Link
        href={back.href}
        className={cn(secondaryButton, "min-h-10 justify-self-start px-4")}
      >
        {back.label}
      </Link>
    </section>
  );
}

/**
 * Placeholder shaped like the profile: header card, then the section cards. Also used by
 * app/tutors/[id]/loading.tsx, so navigation shows the page shape at once.
 */
export function TutorProfileSkeleton() {
  return (
    <div role="status" className="grid gap-6">
      <span className="sr-only">Loading…</span>
      <div className={cn(card, "flex items-start gap-4 p-6")}>
        <Skeleton className="size-11 shrink-0 rounded-full" />
        <div className="grid min-w-0 flex-1 gap-3">
          <Skeleton className="h-7 w-48 max-w-full" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <div className={cn(card, "grid gap-3 p-6")}>
        <Skeleton className="h-6 w-28" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </div>
      <div className={cn(card, "grid gap-3 p-6")}>
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

function TutorDetails({ tutor, id }: { tutor: PublicTutor; id: string }) {
  const verified = tutor.verificationStatus === "APPROVED";
  const videos = tutor.videos.filter(
    (video): video is PublicTutorVideo & { url: string } => video.url !== null,
  );

  return (
    <>
      <header className={cn(card, "flex items-start gap-4 p-6")}>
        <TutorInitial name={tutor.name} />
        <div className="grid min-w-0 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-pretty break-words text-[var(--color-neutral-charcoal)]">
              {tutor.name}
            </h1>
            {verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-semantic-success-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-semantic-success-text)]">
                <BadgeCheck aria-hidden="true" className="size-3.5" />
                Verified
              </span>
            )}
          </div>
          {tutor.instituteName && (
            <p className="flex items-start gap-1.5 text-sm text-pretty text-[var(--color-text-secondary)]">
              <GraduationCap
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              {tutor.instituteName}
            </p>
          )}
          <RatingInline
            ratingAvg={tutor.ratingAvg}
            ratingCount={tutor.ratingCount}
          />
          <p className="text-sm text-[var(--color-text-secondary)] tabular-nums">
            Member since {formatMemberSince(tutor.createdAt)}
          </p>
        </div>
      </header>

      {tutor.subjects.length > 0 && (
        <section
          aria-labelledby="subjects-heading"
          className={cn(card, "grid gap-2 p-6")}
        >
          <h2 id="subjects-heading" className={SECTION_TITLE}>
            Subjects
          </h2>
          <ul className="flex flex-wrap gap-2">
            {tutor.subjects.map((subject) => (
              <li key={subject.id} className={CHIP}>
                {subject.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tutor.areas.length > 0 && (
        <section
          aria-labelledby="areas-heading"
          className={cn(card, "grid gap-2 p-6")}
        >
          <h2 id="areas-heading" className={SECTION_TITLE}>
            Areas
          </h2>
          <ul className="grid gap-2 text-sm text-[var(--color-neutral-charcoal)]">
            {tutor.areas.map((area) => (
              <li
                key={area.id}
                className="flex items-start gap-1.5 text-pretty"
              >
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-[var(--color-text-secondary)]"
                />
                {area.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tutor.credentials.length > 0 && (
        <section
          aria-labelledby="credentials-heading"
          className={cn(card, "grid gap-2 p-6")}
        >
          <h2 id="credentials-heading" className={SECTION_TITLE}>
            Credentials
          </h2>
          <ul className="grid gap-2 text-sm text-[var(--color-neutral-charcoal)]">
            {tutor.credentials.map((credential) => (
              <li key={credential.id} className="text-pretty">
                {`${credential.examLabel} — ${credential.result}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {videos.length > 0 && (
        <section
          aria-labelledby="videos-heading"
          className={cn(card, "grid gap-4 p-6")}
        >
          <h2 id="videos-heading" className={SECTION_TITLE}>
            Videos
          </h2>
          {videos.map((video) => (
            <figure key={video.id} className="grid gap-2">
              <PublicVideo title={video.title} url={video.url} />
              <figcaption className="text-sm text-pretty text-[var(--color-text-secondary)]">
                {video.title}
              </figcaption>
            </figure>
          ))}
        </section>
      )}

      <section
        aria-labelledby="reviews-heading"
        className={cn(card, "grid gap-4 p-6")}
      >
        <h2 id="reviews-heading" className={SECTION_TITLE}>
          Reviews
        </h2>
        <TutorReviewList tutorId={id} />
      </section>
    </>
  );
}

function PublicVideo({ title, url }: { title: string; url: string }) {
  const refreshExpired = useRefreshExpiredMedia();
  return (
    <video
      controls
      preload="metadata"
      src={url}
      onError={refreshExpired}
      aria-label={title}
      className="aspect-video w-full rounded-[12px] bg-black outline outline-1 -outline-offset-1 outline-black/10"
    />
  );
}
