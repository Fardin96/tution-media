import Link from "next/link";
import { GraduationCap, MapPin } from "lucide-react";
import { VerifiedBadgeTip } from "@/components/ui/verified-badge";
import { secondaryButton } from "@/components/profile/styles";
import { cn } from "@/lib/utils";
import { RatingInline } from "@/components/browse/browse-ui";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Rows, Section } from "@/components/applications/detail-sections";
import { TonePill } from "@/components/applications/status-pill";
import {
  curriculaText,
  educationRangeText,
  minSalaryText,
  studentsText,
  subjectNames,
} from "@/components/applications/format";
import { useSubjects } from "@/lib/subjects";
import type { EducationLookup } from "@/lib/education";
import { daysSummary, formatTimeRange } from "@/lib/tutor-requirements";
import type {
  ApplicationTutorProfile,
  ApplicationTutorSet,
} from "@/lib/applications";

const CHIP =
  "rounded-full bg-[var(--color-secondary-sky)] px-3 py-1 text-sm font-medium text-[var(--color-primary-deep)]";

export function TutorProfileSection({
  profile,
}: {
  profile: ApplicationTutorProfile;
}) {
  return (
    <Section title="Tutor">
      <div className="flex items-start gap-4">
        <UserAvatar src={profile.avatarUrl} name={profile.name} size={44} />
        <div className="grid min-w-0 gap-1">
          <p className="font-semibold text-pretty text-[var(--color-neutral-charcoal)]">
            {profile.name}
            {profile.verifiedBadge && <VerifiedBadgeTip size={18} />}
          </p>
          {profile.instituteName && (
            <p className="flex items-start gap-1.5 text-sm text-pretty text-[var(--color-text-secondary)]">
              <GraduationCap
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              {profile.instituteName}
            </p>
          )}
          <RatingInline
            ratingAvg={profile.ratingAvg}
            ratingCount={profile.ratingCount}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4">
        {profile.subjects.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {profile.subjects.map((subject) => (
              <li key={subject.id} className={CHIP}>
                {subject.name}
              </li>
            ))}
          </ul>
        )}
        {profile.areas.length > 0 && (
          <p className="flex items-start gap-1.5 text-sm text-[var(--color-text-secondary)]">
            <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {profile.areas.map((area) => area.name).join(", ")}
          </p>
        )}
        {profile.credentials.length > 0 && (
          <div className="grid gap-2">
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">
              Credentials
            </p>
            <ul className="grid gap-2 text-sm text-[var(--color-neutral-charcoal)]">
              {profile.credentials.map((credential) => (
                <li key={credential.id} className="text-pretty">
                  {`${credential.examLabel} — ${credential.result}`}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <Link
            href={`/tutors/${profile.id}`}
            className={cn(secondaryButton, "min-h-10 px-4")}
          >
            <LinkPendingLabel>View full profile</LinkPendingLabel>
          </Link>
        </div>
      </div>
    </Section>
  );
}

export function TutorSetSection({
  tutorSet,
  lookup,
}: {
  tutorSet: ApplicationTutorSet;
  lookup: EducationLookup | undefined;
}) {
  const { subjects } = useSubjects();
  const { set, matchedBy } = tutorSet;

  const rows = [
    {
      label: "Education",
      value: educationRangeText(
        lookup,
        set.curricula,
        set.levelMin,
        set.levelMax,
      ),
    },
    { label: "Curricula", value: curriculaText(lookup, set.curricula) },
    { label: "Subjects", value: subjectNames(set.subjectIds, subjects) },
    { label: "Time", value: formatTimeRange(set.timeFrom, set.timeTo) },
    { label: "Days", value: daysSummary(set) },
    { label: "Minimum salary", value: minSalaryText(set.minSalary) },
    { label: "Max students", value: studentsText(set.maxStudents) },
  ].filter((row) => row.value !== "");

  return (
    <Section title="Their teaching set">
      <div className="grid gap-4">
        {matchedBy === "DEFAULT" && (
          <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
            None of this tutor&apos;s sets match your requirement exactly. This
            is their default set.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[var(--color-neutral-charcoal)]">
            {set.name}
          </p>
          {set.teachesOnline && <TonePill tone="info">Teaches online</TonePill>}
        </div>
        <Rows rows={rows} />
      </div>
    </Section>
  );
}
