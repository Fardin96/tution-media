"use client";

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  CalendarDays,
  Camera,
  Eye,
  FileText,
  Flag,
  Mail,
  MapPin,
  MessageCircle,
  Pencil,
  PlayCircle,
  Plus,
  Receipt,
  Repeat2,
  RotateCw,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { UserSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  queryKeys,
  invalidateRequirements,
  invalidateTutorProfile,
  invalidateTutorRequirements,
  refreshOwnPublicProfile,
} from "@/lib/query-keys";
import {
  blockedFromServerError,
  describeRemoval,
  removedSubjectIds,
  type BlockedSet,
} from "@/lib/subject-removal";
import {
  subjectRemovalImpact,
  tutorRequirementApi,
  type TutorRequirement,
} from "@/lib/tutor-requirements";
import { toastError } from "@/lib/toast";
import { useIntentPrefetch } from "@/lib/prefetch";
import { usePhoneVerificationStatus } from "@/lib/phone-verification";
import { openFile, useRefreshExpiredMedia } from "@/lib/files";
import {
  credentialLimitReached,
  MAX_TUTOR_CREDENTIALS,
  MAX_TUTOR_VIDEOS,
  videoLimitReached,
} from "@/lib/upload-forms";
import { useAreas } from "@/lib/areas";
import { pausedText, useUploadStatus } from "@/lib/upload-status";
import { useSubjects } from "@/lib/subjects";
import {
  ApiError,
  SECTIONS,
  clearSession,
  useSetVideoHomePage,
  useMyStats,
  myStatsQueryOptions,
  formatBdPhone,
  formFromProfile,
  normalizeBdPhone,
  optionName,
  profileApi,
  profileOf,
  saveTutorLists,
  toPayload,
  type Credential,
  type FieldDef,
  type Me,
  type ProfileForm,
  type ProfileRole,
  type StudentProfile,
  type TutorProfile,
  type Verification,
  type VerificationStatus,
  type Video,
} from "@/lib/profile";
import { educationSummary, useEducationLookup } from "@/lib/education";
import {
  formatPostedDate,
  formatTaka,
  formatTime,
  isPastRequirement,
  postAgainHref,
  requirementApi,
  requirementQueryOptions,
  statusMeta,
  type Requirement,
} from "@/lib/requirements";
import {
  studentRequirementQueryOptions,
  useRecommendedTutors,
  type RecommendedTutor,
} from "@/lib/applications";
import { daysLabel, daysPerWeekLabel, EVERY_DAY } from "@/lib/days";
import { isFeatureEnabled, type FeatureFlags } from "@/lib/features";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { enterClass, enterStyle } from "@/components/motion/enter";
import { revealMotion } from "@/components/motion/swap";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/user-avatar";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import {
  EmptyCard,
  ErrorBlock,
  RatingInline,
} from "@/components/browse/browse-ui";
import { LinkPendingLabel } from "@/components/ui/link-pending-label";
import { PendingLabel } from "@/components/ui/pending-label";
import { DeleteAccountButton } from "@/components/auth/delete-account-button";
import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  ConfirmDialog,
  type ConfirmAction,
} from "@/components/ui/confirm-dialog";
import { TutorPackagesSection } from "@/components/packages/dashboard-section";
import { StoriesSection } from "@/components/stories/stories-section";
import { TutorRequirementsSection } from "@/components/tutor-requirements/dashboard-section";
import { StudentReviewList } from "@/components/reviews/review-list";
import { EditSection, SaveCancelled } from "./edit-section";
import { ProfileStrengthCard } from "./profile-strength-card";
import type { SubmittedVerification } from "./verification-upload-dialog";
import {
  AddButton,
  EmptyState,
  loadFailed,
  PausedNotice,
  Pill,
  SectionHeading,
  type Tone,
} from "./dashboard-kit";
import {
  card,
  focusRing,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "./styles";

// Each dialog loads the first time it opens (see useStayMounted), so its form and upload code
// stay out of the profile's first bundle.
const PhoneVerifyDialog = dynamic(() =>
  import("./phone-verify-dialog").then((m) => m.PhoneVerifyDialog),
);
const CredentialDialog = dynamic(() =>
  import("./credential-dialog").then((m) => m.CredentialDialog),
);
const VerificationUploadDialog = dynamic(() =>
  import("./verification-upload-dialog").then(
    (m) => m.VerificationUploadDialog,
  ),
);
const VideoDialog = dynamic(() =>
  import("./video-dialog").then((m) => m.VideoDialog),
);
const AvatarDialog = dynamic(() =>
  import("./avatar-dialog").then((m) => m.AvatarDialog),
);

/**
 * True while `open`, and after it has been open once. A lazy dialog mounts on its first open and
 * then stays mounted, so its exit fade plays as before and the form resets on close as before.
 */
function useStayMounted(open: boolean) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return open || opened;
}

const WASH = [
  "radial-gradient(55% 80% at 0% 0%, color-mix(in oklab, var(--color-primary-core) 18%, transparent), transparent 70%)",
  "radial-gradient(45% 70% at 100% 0%, color-mix(in oklab, var(--color-mesh-glow) 50%, transparent), transparent 70%)",
  "radial-gradient(40% 60% at 70% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

const VERIFICATION: Record<VerificationStatus, { tone: Tone; label: string }> =
  {
    NOT_SUBMITTED: { tone: "neutral", label: "ID not verified" },
    PENDING: { tone: "warning", label: "In review" },
    APPROVED: { tone: "success", label: "ID verified" },
    REJECTED: { tone: "error", label: "Rejected" },
  };

const VIDEO_STATUS: Record<Video["status"], { tone: Tone; label: string }> = {
  PENDING: { tone: "warning", label: "Pending review" },
  APPROVED: { tone: "success", label: "Live" },
  REJECTED: { tone: "error", label: "Rejected" },
};

/** The blocked-subject dialog's action that archives the one set in the way. */
const ARCHIVE_LABEL = "Archive set";

const monthYear = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(
    new Date(iso),
  );

interface TutorData {
  credentials: Credential[] | null;
  videos: Video[] | null;
  verifications: Verification[] | null;
}

interface StudentData {
  requirements: Requirement[] | null;
}

type LoadResult =
  | { kind: "redirect"; to: "/onboarding" | "/sign-in" }
  | {
      kind: "ok";
      me: Me;
      form: ProfileForm;
      tutorData: TutorData;
      studentData: StudentData;
    };

async function loadDashboard(queryClient: QueryClient): Promise<LoadResult> {
  let account: Me;
  try {
    account = await profileApi.me();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401)
      return { kind: "redirect", to: "/sign-in" };
    throw err;
  }
  const profile = profileOf(account);
  if (!profile) return { kind: "redirect", to: "/onboarding" };
  // The counts are not needed to paint, but starting them now saves a round trip after render.
  if (account.tutor || account.student)
    void queryClient.prefetchQuery(myStatsQueryOptions);

  const tutorData: TutorData = {
    credentials: null,
    videos: null,
    verifications: null,
  };
  const studentData: StudentData = {
    requirements: null,
  };

  let extras = {};
  if (account.tutor) {
    const [ext, credentials, videos, verifications] = await Promise.allSettled([
      profileApi.tutorExtras(account.tutor.id),
      profileApi.credentials(),
      profileApi.videos(),
      profileApi.verifications(),
    ]);
    const ok = <T,>(r: PromiseSettledResult<T>) =>
      r.status === "fulfilled" ? r.value : null;
    const e = ok(ext);
    extras = {
      areaIds: e?.areas.map((a) => a.id) ?? [],
      subjectIds: e?.subjects.map((s) => s.id) ?? [],
    };
    tutorData.credentials = ok(credentials);
    tutorData.videos = ok(videos);
    tutorData.verifications = ok(verifications);
  } else if (account.student) {
    const [reqs] = await Promise.allSettled([requirementApi.mine()]);
    studentData.requirements = reqs.status === "fulfilled" ? reqs.value : null;
  }

  return {
    kind: "ok",
    me: account,
    form: formFromProfile(profile, extras),
    tutorData,
    studentData,
  };
}

export function ProfileDashboard({
  session,
  featureFlags,
}: {
  session: UserSession;
  featureFlags: FeatureFlags;
}) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [tutorData, setTutorData] = useState<TutorData>({
    credentials: null,
    videos: null,
    verifications: null,
  });
  const [studentData, setStudentData] = useState<StudentData>({
    requirements: null,
  });
  const [loadError, setLoadError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const retryLoad = () => {
    setRetrying(true);
    setAttempt((a) => a + 1);
  };

  const queryClient = useQueryClient();
  // `me` is local state, so a fix made on this page re-reads the strength and apply checklist.
  const refreshStrength = () => {
    void profileApi
      .me()
      .then((a) =>
        setMe(
          (m) =>
            m && {
              ...m,
              profileStrength: a.profileStrength,
              applyReadiness: a.applyReadiness,
            },
        ),
      )
      .catch(() => undefined);
  };
  const [dialog, setDialog] = useState<{
    title: string;
    body: string[];
    actions: ConfirmAction[];
  } | null>(null);
  const dialogResolver = useRef<((ok: boolean) => void) | null>(null);
  // Content stays set after close so the exit fade doesn't flash an empty dialog.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [phoneDialog, setPhoneDialog] = useState<{
    open: boolean;
    initialNumber: string | null;
  }>({ open: false, initialNumber: null });
  const phoneDialogMounted = useStayMounted(phoneDialog.open);
  const phoneStatus = usePhoneVerificationStatus();
  const phoneRequired = phoneStatus.data?.required ?? false;
  const openPhoneDialog = (initialNumber: string | null = null) =>
    setPhoneDialog({ open: true, initialNumber });

  useEffect(() => {
    let live = true;
    loadDashboard(queryClient)
      .then(async (result) => {
        if (!live) return;
        if (result.kind === "redirect") {
          if (result.to === "/sign-in") await clearSession();
          router.replace(result.to);
          return;
        }
        setTutorData(result.tutorData);
        setStudentData(result.studentData);
        setMe(result.me);
        setForm(result.form);
        setLoadError(null);
        setRetrying(false);
      })
      .catch((err) => {
        if (live) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load your profile.",
          );
          setRetrying(false);
        }
      });
    return () => {
      live = false;
    };
  }, [router, attempt, queryClient]);

  const role = session.role as ProfileRole;
  const profile = me && profileOf(me);

  const closeDialog = (ok: boolean) => {
    const resolve = dialogResolver.current;
    dialogResolver.current = null;
    setDialogOpen(false);
    resolve?.(ok);
  };

  const askConfirm = (title: string, body: string[]) =>
    new Promise<boolean>((resolve) => {
      dialogResolver.current = resolve;
      setDialogOpen(true);
      setDialog({
        title,
        body,
        actions: [
          {
            label: "Remove",
            variant: "primary",
            onSelect: () => closeDialog(true),
          },
          {
            label: "Cancel",
            variant: "secondary",
            onSelect: () => closeDialog(false),
          },
        ],
      });
    });

  const [archiving, setArchiving] = useState(false);
  const archiveBlockedSet = async (id: string) => {
    setArchiving(true);
    try {
      await tutorRequirementApi.archive(id);
      await invalidateTutorRequirements(queryClient);
      toast.success("Set archived. Save again to remove the subject.");
      closeDialog(false);
    } catch (err) {
      toastError("Couldn't archive that set.", err);
    } finally {
      setArchiving(false);
    }
  };

  const openBlocked = (blocked: {
    title: string;
    body: string[];
    sets: BlockedSet[];
  }) => {
    const actions: ConfirmAction[] = blocked.sets.map((s) => ({
      label: `Edit '${s.name}'`,
      href: `/dashboard/tutor/requirements/${s.id}/edit`,
      variant: "secondary",
      onSelect: () => closeDialog(false),
    }));
    if (blocked.sets.length === 1 && !blocked.sets[0].isDefault) {
      const id = blocked.sets[0].id;
      actions.push({
        label: ARCHIVE_LABEL,
        variant: "secondary",
        onSelect: () => void archiveBlockedSet(id),
      });
    }
    actions.push({
      label: "Cancel",
      variant: "ghost",
      onSelect: () => closeDialog(false),
    });
    setDialogOpen(true);
    setDialog({ title: blocked.title, body: blocked.body, actions });
  };

  const { subjects } = useSubjects();
  const { areas } = useAreas();
  const saveSection = async (next: ProfileForm, fields: FieldDef[]) => {
    if (!me) return;
    const keys = fields.map((f) => f.key);
    const touchesSubjects = role === "TUTOR" && keys.includes("subjectIds");

    let sets: TutorRequirement[] | undefined;
    if (touchesSubjects) {
      const removed = removedSubjectIds(
        form?.subjectIds ?? [],
        next.subjectIds,
      );
      if (removed.length) {
        const all = await queryClient.fetchQuery({
          queryKey: queryKeys.tutor.requirements.list("all"),
          queryFn: () => tutorRequirementApi.list("all"),
          // Never trust a cached list here: a set created a moment ago must be checked.
          staleTime: 0,
        });
        sets = all;
        const d = describeRemoval(
          subjectRemovalImpact(all, removed),
          removed,
          (id) => optionName(subjects, id),
        );
        if (d.kind === "blocked") {
          openBlocked(d);
          throw new SaveCancelled();
        }
        if (d.kind === "confirm" && !(await askConfirm(d.title, d.body))) {
          throw new SaveCancelled();
        }
      }
    }

    try {
      const body = toPayload(role, next, keys);
      if (Object.keys(body).length) {
        const updated = await profileApi.update(role, body);
        setMe(
          (m) =>
            m &&
            (role === "STUDENT"
              ? {
                  ...m,
                  student: { ...m.student!, ...(updated as StudentProfile) },
                }
              : {
                  ...m,
                  tutor: { ...m.tutor!, ...(updated as TutorProfile) },
                }),
        );
      }
      if (role === "TUTOR") await saveTutorLists(next, keys);
    } catch (err) {
      // A new number must be verified first. Keep the section open on that number.
      if (
        err instanceof ApiError &&
        err.code === "PHONE_VERIFICATION_REQUIRED"
      ) {
        openPhoneDialog(normalizeBdPhone(next.phoneNumber));
        throw new SaveCancelled();
      }
      const blocked = blockedFromServerError(err, sets ?? []);
      if (!blocked) throw err;
      openBlocked(blocked);
      throw new SaveCancelled();
    }

    if (touchesSubjects) {
      await invalidateTutorRequirements(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.tutor.profileSubjects,
      });
    }
    if (role === "TUTOR" && profile) {
      void invalidateTutorProfile(queryClient, profile.id);
    }
    setForm(
      (f) =>
        f && { ...f, ...Object.fromEntries(keys.map((k) => [k, next[k]])) },
    );
    refreshStrength();
  };

  const removeCredential = async (id: string) => {
    await profileApi.deleteCredential(id);
    refreshOwnPublicProfile();
    refreshStrength();
    setTutorData((d) => ({
      ...d,
      credentials: d.credentials?.filter((c) => c.id !== id) ?? null,
    }));
  };

  const removeVideo = async (id: string) => {
    await profileApi.deleteVideo(id);
    refreshStrength();
    setTutorData((d) => ({
      ...d,
      videos: d.videos?.filter((v) => v.id !== id) ?? null,
    }));
  };

  const addCredential = (credential: Credential) => {
    refreshOwnPublicProfile();
    refreshStrength();
    setTutorData((d) => ({
      ...d,
      credentials:
        d.credentials &&
        [...d.credentials, credential].sort((a, b) =>
          a.examLabel.localeCompare(b.examLabel),
        ),
    }));
  };

  const addVideo = (video: Video) => {
    refreshStrength();
    setTutorData((d) => ({
      ...d,
      videos: d.videos && [...d.videos, video],
    }));
  };

  // The server's copy after a home-page change, so the box and the landing state agree.
  const updateVideo = (video: Video) => {
    setTutorData((d) => ({
      ...d,
      videos: d.videos?.map((v) => (v.id === video.id ? video : v)) ?? null,
    }));
  };

  const phoneVerified = (result: {
    phoneNumber: string;
    verifiedAt: string;
  }) => {
    const change = {
      phoneNumber: result.phoneNumber,
      phoneVerifiedAt: result.verifiedAt,
    };
    setMe(
      (m) =>
        m &&
        (role === "STUDENT"
          ? { ...m, student: { ...m.student!, ...change } }
          : { ...m, tutor: { ...m.tutor!, ...change } }),
    );
    // The edit form reads the number from here, so a changed number shows at once.
    setForm((f) => f && { ...f, phoneNumber: result.phoneNumber });
    refreshStrength();
  };

  const verificationSent = (result: SubmittedVerification) => {
    if (result.role === "STUDENT") {
      setMe(
        (m) => m && { ...m, student: { ...m.student!, ...result.profile } },
      );
    } else {
      setMe(
        (m) =>
          m && {
            ...m,
            tutor: { ...m.tutor!, verificationStatus: "PENDING" },
          },
      );
      setTutorData((d) => ({
        ...d,
        verifications: d.verifications && [
          result.verification,
          ...d.verifications,
        ],
      }));
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.me });
    refreshStrength();
  };

  const displayName = profile?.name || session.name || "there";

  // The Hero, TopBar and photo dialog all show the same signed link, and useRefreshExpiredMedia
  // does not refetch /me. So an expired link refetches /me once; the ref keeps the others quiet.
  const refetchedAvatar = useRef<string | null>(null);
  const refreshExpiredAvatar = (expired: string | null | undefined) => {
    if (!expired || refetchedAvatar.current === expired) return;
    refetchedAvatar.current = expired;
    void profileApi
      .me()
      .then((account) =>
        setMe((m) => m && { ...m, avatarUrl: account.avatarUrl }),
      )
      .catch(() => undefined);
  };

  return (
    <div className="min-h-dvh bg-[var(--color-neutral-off-white)]">
      <TopBar
        name={displayName}
        avatarUrl={me?.avatarUrl}
        picture={session.picture}
        onExpired={() => refreshExpiredAvatar(me?.avatarUrl)}
      />

      {loadError ? (
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <div className={cn(card, "p-8")} role="alert">
            <h1 className="text-xl font-semibold text-[var(--color-neutral-charcoal)]">
              We couldn&apos;t load your profile
            </h1>
            <p className="mt-2 text-sm text-pretty text-[var(--color-text-secondary)]">
              {loadError}
            </p>
            <button
              type="button"
              disabled={retrying}
              aria-busy={retrying || undefined}
              onClick={retryLoad}
              className={cn(primaryButton, "mt-6")}
            >
              <PendingLabel pending={retrying}>
                <RotateCw aria-hidden="true" className="size-4" />
                Try again
              </PendingLabel>
            </button>
          </div>
        </main>
      ) : !me || !profile || !form ? (
        <DashboardSkeleton />
      ) : (
        <>
          <Hero
            role={role}
            name={displayName}
            picture={session.picture}
            avatarUrl={me.avatarUrl}
            onAvatarChanged={(url) => {
              setMe((m) => m && { ...m, avatarUrl: url });
              refreshStrength();
            }}
            onAvatarExpired={() => refreshExpiredAvatar(me.avatarUrl)}
            profile={profile}
            verifiedBadge={me.profileStrength?.verifiedBadge ?? false}
            areaLabel={
              me.student
                ? optionName(areas, me.student.areaId)
                : form.areaIds.length
                  ? `${form.areaIds.length} area${form.areaIds.length > 1 ? "s" : ""}`
                  : null
            }
            aside={
              <ProfileStrengthCard
                role={role}
                strength={me.profileStrength}
                applyReadiness={me.applyReadiness}
                onVerifyPhone={() => openPhoneDialog()}
              />
            }
          />

          <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
            <Stats
              role={role}
              profileId={profile.id}
              rating={Number(profile.ratingAvg)}
              ratingCount={profile.ratingCount}
            />

            <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
              <div className="grid min-w-0 content-start gap-12">
                <section
                  id="profile"
                  aria-labelledby="profile-heading"
                  className="scroll-mt-24"
                >
                  <SectionHeading
                    id="profile-heading"
                    title="Your profile"
                    description={
                      role === "TUTOR"
                        ? "What students and admins see. Keep it current to get more requests."
                        : "What tutors and admins see when you post a requirement."
                    }
                  />
                  {role === "STUDENT" &&
                    phoneRequired &&
                    !profile.phoneVerifiedAt && (
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-[var(--color-semantic-warning-surface)] p-4">
                        <p className="text-sm font-medium text-pretty text-[var(--color-semantic-warning-text)]">
                          Verify your phone number before posting a requirement.
                        </p>
                        <button
                          type="button"
                          onClick={() => openPhoneDialog()}
                          className={cn(secondaryButton, "min-h-10 px-4")}
                        >
                          Verify
                        </button>
                      </div>
                    )}
                  <div className="mt-5 grid gap-4">
                    {SECTIONS[role].map((section) => (
                      <EditSection
                        key={section.id}
                        section={section}
                        values={form}
                        onSave={saveSection}
                        verifiedPhone={
                          profile.phoneVerifiedAt ? profile.phoneNumber : null
                        }
                        phoneLocked={phoneRequired}
                        onVerifyNumber={() => openPhoneDialog()}
                      />
                    ))}
                  </div>
                </section>

                {role === "TUTOR" ? (
                  <>
                    <CredentialsSection
                      credentials={tutorData.credentials}
                      onRemove={removeCredential}
                      onAdded={addCredential}
                    />
                    <VideosSection
                      videos={tutorData.videos}
                      onRemove={removeVideo}
                      onAdded={addVideo}
                      onUpdated={updateVideo}
                    />
                    <StoriesSection role="TUTOR" />
                    <TutorPackagesSection />
                    <TeachingZonesCard />
                    <FindWorkCard />
                    <PlacementFeesCard />
                    <ReportsCard />
                    <TutorRequirementsSection />
                  </>
                ) : (
                  <>
                    <Suspense fallback={null}>
                      <RequirementsSection
                        requirements={studentData.requirements}
                        onUpdateRequirement={(updated) => {
                          setStudentData((d) => ({
                            ...d,
                            requirements: d.requirements?.map((r) =>
                              r.id === updated.id ? updated : r,
                            ) ?? [updated],
                          }));
                        }}
                      />
                    </Suspense>
                    <StoriesSection role="STUDENT" />
                    <ApplicationsCard />
                    <StudentReviewsSection profileId={profile.id} />
                    <ReportsCard />
                    <RecommendedTutors
                      requirements={studentData.requirements}
                      onRetry={retryLoad}
                      retrying={retrying}
                    />
                  </>
                )}
              </div>

              <aside className="grid content-start gap-4" aria-label="Account">
                <VerificationCard
                  role={role}
                  status={profile.verificationStatus}
                  note={
                    me.student
                      ? me.student.verificationNote
                      : (tutorData.verifications?.[0]?.note ?? null)
                  }
                  submittedAt={
                    me.student
                      ? me.student.verificationSubmittedAt
                      : (tutorData.verifications?.[0]?.submittedAt ?? null)
                  }
                  hasStudentIdNumber={Boolean(profile.studentIdNumber?.trim())}
                  onSubmitted={verificationSent}
                />
                <AccountCard
                  email={me.email}
                  since={me.createdAt}
                  phone={profile.phoneNumber}
                  phoneVerifiedAt={profile.phoneVerifiedAt}
                  onVerifyPhone={() => openPhoneDialog()}
                  whatsapp={profile.whatsappNumber}
                  whatsappVerified={!!profile.whatsappVerifiedAt}
                  featureFlags={featureFlags}
                />
                <HelpCard />
              </aside>
            </div>
          </main>
        </>
      )}

      {profile && phoneDialogMounted && (
        <PhoneVerifyDialog
          open={phoneDialog.open}
          onOpenChange={(open) => setPhoneDialog((d) => ({ ...d, open }))}
          currentPhone={profile.phoneNumber}
          currentVerifiedAt={profile.phoneVerifiedAt}
          initialNumber={phoneDialog.initialNumber}
          onVerified={phoneVerified}
        />
      )}

      <ConfirmDialog
        open={dialogOpen}
        title={dialog?.title ?? ""}
        actions={(dialog?.actions ?? []).map((a) =>
          a.label === ARCHIVE_LABEL ? { ...a, pending: archiving } : a,
        )}
        onOpenChange={(open) => {
          if (!open) closeDialog(false);
        }}
      >
        {dialog?.body.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </ConfirmDialog>
    </div>
  );
}

/* ───────── Chrome ───────── */

export function TopBar({
  name,
  avatarUrl,
  picture,
  onExpired,
}: {
  name: string;
  /** The same upload the Hero shows; the Google picture is only the fallback. Undefined until /me loads. */
  avatarUrl?: string | null;
  picture?: string;
  onExpired?: () => void;
}) {
  // Initials until /me loads: the Google picture would otherwise show, then swap for the upload.
  const src = avatarUrl === undefined ? null : (avatarUrl ?? picture);
  return (
    <header className="sticky top-0 z-40 bg-[color-mix(in_oklab,var(--color-neutral-white)_85%,transparent)] shadow-[0_1px_0_rgb(0_0_0/0.06)] backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" data-home-link className={cn("rounded-lg", focusRing)}>
          <Image
            src="/assets/ic-demo/Icon-blue.png"
            alt="Masters Hub home"
            width={860}
            height={220}
            preload
            className="h-9 w-auto"
          />
        </Link>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <span className="hidden items-center gap-2 sm:flex">
            <UserAvatar src={src} name={name} size={32} onExpired={onExpired} />
            <span
              className="max-w-40 truncate text-sm font-medium text-[var(--color-neutral-charcoal)]"
              title={name}
            >
              {name}
            </span>
          </span>
          <LogoutButton className="h-10 w-auto px-4 text-sm" />
        </div>
      </div>
    </header>
  );
}

/* ───────── Hero ───────── */

function Hero({
  role,
  name,
  picture,
  avatarUrl,
  onAvatarChanged,
  onAvatarExpired,
  profile,
  verifiedBadge,
  areaLabel,
  aside,
}: {
  role: ProfileRole;
  name: string;
  /** The Google picture from sign-in, shown only when the account has no avatar. */
  picture?: string;
  avatarUrl: string | null;
  onAvatarChanged: (avatarUrl: string | null) => void;
  /** Refetches the account when the signed photo link has expired. */
  onAvatarExpired: () => void;
  profile: NonNullable<ReturnType<typeof profileOf>>;
  verifiedBadge: boolean;
  areaLabel: string | null;
  /** Sits right of the photo and name on wide screens (the profile strength card). */
  aside?: React.ReactNode;
}) {
  const v = VERIFICATION[profile.verificationStatus];
  const [photoOpen, setPhotoOpen] = useState(false);
  const photoDialogMounted = useStayMounted(photoOpen);

  return (
    <div
      className="relative isolate overflow-hidden"
      style={{ backgroundImage: WASH }}
    >
      {/* Concentric rings, the auth panel's motif. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-40 -z-10 hidden [mask-image:radial-gradient(closest-side,black_35%,transparent)] md:block"
      >
        {[320, 480, 640].map((s) => (
          <span
            key={s}
            className="absolute top-1/2 left-1/2 -translate-1/2 rounded-full border border-[color-mix(in_oklab,var(--color-primary-core)_14%,transparent)]"
            style={{ width: s, height: s }}
          />
        ))}
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 pt-8 pb-10 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <div
            id="profile-photo"
            data-attention-round
            className="relative w-fit shrink-0 rounded-full"
          >
            <UserAvatar
              src={avatarUrl ?? picture}
              name={name}
              size={96}
              onExpired={onAvatarExpired}
              className="shadow-[0_0_0_4px_var(--color-neutral-white),0_12px_32px_-8px_rgb(0_0_0/0.25)]"
            />
            {/* 44px hit area around a 32px badge, so the target meets touch sizing. */}
            <button
              type="button"
              aria-label="Change profile picture"
              onClick={() => setPhotoOpen(true)}
              className={cn(
                "group absolute -end-2 -bottom-2 grid size-11 place-items-center rounded-full",
                focusRing,
              )}
            >
              {/* The press scales the visible badge, not the 44px hit area around it. */}
              <span
                aria-hidden="true"
                className="grid size-8 place-items-center rounded-full bg-[var(--color-primary-core)] text-[var(--color-neutral-white)] shadow-[0_0_0_2px_var(--color-neutral-white)] transition-[scale] duration-150 ease-out group-active:scale-[0.96] motion-reduce:transition-none"
              >
                <Camera className="size-4" />
              </span>
            </button>
            {photoDialogMounted && (
              <AvatarDialog
                open={photoOpen}
                onOpenChange={setPhotoOpen}
                role={role}
                avatarUrl={avatarUrl}
                name={name}
                tutorId={role === "TUTOR" ? profile.id : null}
                onChanged={onAvatarChanged}
                onExpired={onAvatarExpired}
              />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-primary-deep)]">
              {role === "TUTOR" ? "Tutor dashboard" : "Student dashboard"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight break-words text-[var(--color-neutral-charcoal)] sm:text-4xl">
              {name}
              {verifiedBadge && <VerifiedBadge size={24} className="ms-2" />}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone={v.tone}>{v.label}</Pill>
              {role === "TUTOR" && (
                <Pill
                  tone={
                    (profile as { isListed?: boolean }).isListed
                      ? "success"
                      : "neutral"
                  }
                >
                  {(profile as { isListed?: boolean }).isListed
                    ? "Listed in directory"
                    : "Not listed yet"}
                </Pill>
              )}
              {areaLabel && (
                <span className="inline-flex items-center gap-1 text-sm text-[var(--color-neutral-charcoal)]">
                  <MapPin
                    aria-hidden="true"
                    className="size-4 text-[var(--color-primary-deep)]"
                  />
                  {areaLabel}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-sm text-[var(--color-neutral-charcoal)]">
                <CalendarDays
                  aria-hidden="true"
                  className="size-4 text-[var(--color-primary-deep)]"
                />
                Joined {monthYear(profile.createdAt)}
              </span>
              {role === "TUTOR" && (
                <Link
                  href={`/tutors/${profile.id}`}
                  className={cn(ghostButton, "min-h-10 px-3")}
                >
                  <LinkPendingLabel>View public profile</LinkPendingLabel>
                </Link>
              )}
            </div>
          </div>
        </div>
        {aside}
      </div>
    </div>
  );
}

/* ───────── Stats ───────── */

type StatTile = {
  icon: LucideIcon;
  label: string;
  bg: string;
  /** Where the number is counted. Omitted when no page shows it. */
  href?: string;
  /** undefined while a count loads. */
  value: number | string | undefined;
  /** Counts come from GET /me/stats and show "—" when it fails. The rating comes from /me. */
  fromStats: boolean;
};

/** The dashboard's at-a-glance row. Counts come from GET /me/stats; the rating comes from /me. */
export function Stats({
  role,
  profileId,
  rating,
  ratingCount,
}: {
  role: ProfileRole;
  profileId: string;
  rating: number;
  ratingCount: number;
}) {
  const stats = useMyStats(role);
  const counts = stats.data;
  const tutor = counts?.role === "TUTOR" ? counts : undefined;
  const student = counts?.role === "STUDENT" ? counts : undefined;

  const ratingTile: StatTile = {
    icon: Star,
    label: ratingCount
      ? `Rating · ${ratingCount} ${ratingCount === 1 ? "review" : "reviews"}`
      : "Rating",
    value: ratingCount ? rating.toFixed(1) : "No reviews yet",
    bg: "var(--color-secondary-cream)",
    fromStats: false,
  };
  const tiles: StatTile[] =
    role === "TUTOR"
      ? [
          {
            icon: Briefcase,
            label: "Applications sent",
            value: tutor?.applicationsSent,
            bg: "var(--color-secondary-sky)",
            href: "/dashboard/applications?initiatedBy=TUTOR",
            fromStats: true,
          },
          {
            icon: Users,
            label: "Active students",
            value: tutor?.activeStudents,
            bg: "var(--color-secondary-lime)",
            href: "/dashboard/applications?status=CONFIRMED",
            fromStats: true,
          },
          {
            icon: Mail,
            label: "Invites received",
            value: tutor?.invitesReceived,
            bg: "var(--color-secondary-peach)",
            href: "/dashboard/find-tuitions?scope=invited",
            fromStats: true,
          },
          { ...ratingTile, href: `/tutors/${profileId}` },
        ]
      : [
          {
            icon: BookOpen,
            label: "Open requirements",
            value: student?.openRequirements,
            bg: "var(--color-secondary-sky)",
            href: "#requirements",
            fromStats: true,
          },
          {
            icon: Briefcase,
            label: "Applications received",
            value: student?.applicationsReceived,
            bg: "var(--color-secondary-lime)",
            href: "/dashboard/applications?initiatedBy=TUTOR",
            fromStats: true,
          },
          {
            // Hired is CONFIRMED or COMPLETED; the unfiltered list shows both.
            icon: Users,
            label: "Tutors hired",
            value: student?.tutorsHired,
            bg: "var(--color-secondary-peach)",
            href: "/dashboard/applications",
            fromStats: true,
          },
          { ...ratingTile, href: "#reviews" },
        ];

  // A background refetch that fails keeps the counts already shown; only a failure with no data shows dashes.
  const failedNoData = stats.isError && stats.data === undefined;

  return (
    <section aria-labelledby="stats-heading" className="-mt-2">
      <h2 id="stats-heading" className="sr-only">
        At a glance
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <StatTileView tile={tile} failed={tile.fromStats && failedNoData} />
          </li>
        ))}
      </ul>
      {failedNoData && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => void stats.refetch()}
            disabled={stats.isFetching}
            aria-busy={stats.isFetching || undefined}
            className={cn(ghostButton, "min-h-10 px-3")}
          >
            <PendingLabel pending={stats.isFetching}>Retry</PendingLabel>
          </button>
        </div>
      )}
    </section>
  );
}

/** Press and hover feedback for a tile that links somewhere. */
const TILE_LINK =
  "transition-[scale,box-shadow] duration-150 ease-out hover:shadow-[0_0_0_1px_rgb(0_0_0/0.08),0_1px_2px_rgb(0_0_0/0.04),0_16px_36px_-12px_rgb(0_0_0/0.12)] active:scale-[0.96] motion-reduce:transition-none";

function StatTileView({ tile, failed }: { tile: StatTile; failed: boolean }) {
  const { icon: Icon, label, bg, href, value, fromStats } = tile;
  const text = typeof value === "number" ? String(value) : value;
  const className = cn(
    "flex h-full min-h-32 flex-col justify-between gap-4 rounded-[20px] p-4 sm:p-5",
    href && cn(focusRing, TILE_LINK),
  );

  let figure: ReactNode;
  if (failed) {
    figure = (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">Couldn&apos;t load</span>
      </>
    );
  } else if (fromStats && value === undefined) {
    figure = (
      <>
        <Skeleton className="h-9 w-12 rounded-lg" />
        <span className="sr-only">Loading</span>
      </>
    );
  } else {
    figure = text;
  }

  // Block-level wrappers, not spans: the skeleton is a div and can't sit inside a span.
  const content = (
    <>
      <span className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-neutral-white)_70%,transparent)] text-[var(--color-neutral-charcoal)]">
        <Icon aria-hidden="true" className="size-[18px]" />
      </span>
      <div>
        <div
          className={cn(
            "font-semibold tracking-tight text-[var(--color-neutral-charcoal)] tabular-nums",
            text && text.length > 4 ? "text-base" : "text-3xl",
          )}
        >
          {figure}
        </div>
        <span className="mt-0.5 block text-sm text-[var(--color-neutral-charcoal)]/80">
          {label}
        </span>
      </div>
    </>
  );

  // next/link scrolls to a hash but leaves focus on the tile. A plain anchor keeps the hash
  // jump, and the section (tabIndex -1) takes focus too: fragment jumps don't move focus in
  // every browser. preventScroll leaves the scroll to the hash jump.
  if (href?.startsWith("#")) {
    return (
      <a
        href={href}
        onClick={() =>
          document.getElementById(href.slice(1))?.focus({ preventScroll: true })
        }
        className={className}
        style={{ backgroundColor: bg }}
      >
        {content}
      </a>
    );
  }

  return href ? (
    <Link href={href} className={className} style={{ backgroundColor: bg }}>
      {content}
    </Link>
  ) : (
    <div className={className} style={{ backgroundColor: bg }}>
      {content}
    </div>
  );
}

/* ───────── Tutor sections (live) ───────── */

function RemovableRow({
  icon,
  title,
  meta,
  badge,
  action,
  preview,
  onRemove,
  className,
  style,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  /** Full-width content under the title row, e.g. a video player. */
  preview?: React.ReactNode;
  onRemove: () => Promise<void>;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:px-5",
        className,
      )}
      style={style}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium break-words text-[var(--color-neutral-charcoal)]">
          {title}
        </span>
        {meta && (
          <span className="block text-sm text-[var(--color-text-secondary)]">
            {meta}
          </span>
        )}
      </span>
      {badge}
      {action}
      {preview && (
        <div className="grid min-w-0 basis-full gap-3 ps-14">{preview}</div>
      )}
      {confirming ? (
        <span className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className={cn(secondaryButton, "min-h-10 px-4")}
          >
            Keep
          </button>
          <button
            type="button"
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={async () => {
              setBusy(true);
              try {
                await onRemove();
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Couldn't remove.",
                );
                setBusy(false);
                setConfirming(false);
              }
            }}
            className={cn(
              secondaryButton,
              "min-h-10 bg-[var(--color-semantic-error-surface)] px-4 text-[var(--color-semantic-error-text)] shadow-none hover:bg-[color-mix(in_oklab,var(--color-semantic-error-surface),var(--color-semantic-error-text)_8%)]",
            )}
          >
            <PendingLabel pending={busy}>Yes, remove</PendingLabel>
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={cn(
            ghostButton,
            "min-h-10 px-3 text-[var(--color-text-secondary)] hover:bg-[var(--color-semantic-error-surface)] hover:text-[var(--color-semantic-error-text)]",
          )}
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Remove<span className="sr-only"> {title}</span>
        </button>
      )}
    </li>
  );
}

function ViewFileButton({ fileId, label }: { fileId: string; label: string }) {
  const [opening, setOpening] = useState(false);
  return (
    <button
      type="button"
      disabled={opening}
      aria-busy={opening || undefined}
      onClick={() => {
        setOpening(true);
        openFile(fileId)
          .catch((err) => toastError("Couldn't open the file.", err))
          .finally(() => setOpening(false));
      }}
      className={cn(ghostButton, "min-h-10 px-3")}
    >
      <PendingLabel pending={opening}>
        <Eye aria-hidden="true" className="size-4" />
        View<span className="sr-only"> {label}</span>
      </PendingLabel>
    </button>
  );
}

function VideoPreview({ video }: { video: Video }) {
  const refreshExpired = useRefreshExpiredMedia();
  return (
    <>
      {video.status === "REJECTED" && (
        <p className="rounded-[12px] bg-[var(--color-semantic-error-surface)] px-3 py-2 text-sm text-pretty text-[var(--color-semantic-error-text)]">
          {video.moderationNote
            ? `Admin note: ${video.moderationNote}`
            : "An admin did not approve this video."}
        </p>
      )}
      {video.url ? (
        <video
          controls
          preload="metadata"
          src={video.url}
          onError={refreshExpired}
          aria-label={video.title}
          className="aspect-video w-full rounded-[12px] bg-black outline outline-1 -outline-offset-1 outline-black/10"
        />
      ) : (
        <p className="rounded-[12px] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          Preview unavailable
        </p>
      )}
    </>
  );
}

function CredentialsSection({
  credentials,
  onRemove,
  onAdded,
}: {
  credentials: Credential[] | null;
  onRemove: (id: string) => Promise<void>;
  onAdded: (credential: Credential) => void;
}) {
  const [adding, setAdding] = useState(false);
  const addingMounted = useStayMounted(adding);
  const uploadStatus = useUploadStatus();
  const blockedText = pausedText(uploadStatus.data, "documents");
  // Without the list the count is unknown, so the add button waits for a reload.
  const full =
    credentials !== null && credentialLimitReached(credentials.length);
  const canAdd = credentials !== null && !full && !blockedText;
  return (
    <section
      id="credentials"
      aria-labelledby="credentials-heading"
      className="scroll-mt-24"
    >
      <SectionHeading
        id="credentials-heading"
        title="Exam credentials"
        description="SSC, HSC and university results. Verified tutors get listed first."
        action={
          canAdd ? (
            <AddButton label="Add credential" onClick={() => setAdding(true)} />
          ) : undefined
        }
      />
      {blockedText && (
        <div className="mt-5">
          <PausedNotice text={blockedText} note={uploadStatus.data?.note} />
        </div>
      )}
      <div className={cn(card, "mt-5 overflow-hidden")}>
        {credentials === null ? (
          loadFailed
        ) : credentials.length === 0 ? (
          <EmptyState
            icon={<FileText aria-hidden="true" className="size-5" />}
            title="No credentials yet"
            body="Add a result sheet from SSC, HSC or university."
          />
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-border)]">
            {credentials.map((c, i) => (
              <RemovableRow
                key={c.id}
                icon={<FileText aria-hidden="true" className="size-5" />}
                title={c.examLabel}
                meta={`Result: ${c.result}`}
                action={
                  <ViewFileButton fileId={c.file.id} label={c.examLabel} />
                }
                onRemove={() => onRemove(c.id)}
                className={enterClass}
                style={enterStyle(i)}
              />
            ))}
          </ul>
        )}
      </div>
      {full && (
        <p className="mt-3 text-sm text-pretty text-[var(--color-text-secondary)]">
          You have {MAX_TUTOR_CREDENTIALS} credentials, the most allowed. Remove
          one to add another.
        </p>
      )}
      {addingMounted && (
        <CredentialDialog
          open={adding}
          onOpenChange={setAdding}
          onAdded={onAdded}
        />
      )}
    </section>
  );
}

export function VideosSection({
  videos,
  onRemove,
  onAdded,
  onUpdated,
}: {
  videos: Video[] | null;
  onRemove: (id: string) => Promise<void>;
  onAdded: (video: Video) => void;
  onUpdated: (video: Video) => void;
}) {
  const [adding, setAdding] = useState(false);
  const addingMounted = useStayMounted(adding);
  const uploadStatus = useUploadStatus();
  const blockedText = pausedText(uploadStatus.data, "videos");
  // Without the list the count is unknown, so the add button waits for a reload.
  const full = videos !== null && videoLimitReached(videos.length);
  const canAdd = videos !== null && !full && !blockedText;
  const setHomePage = useSetVideoHomePage(onUpdated);
  // The box stays on the saved value until the server answers, so a failed save reverts it.
  const saveHomePage = (video: Video, show: boolean) => {
    setHomePage
      .mutateAsync({ id: video.id, show })
      .then(() => toast.success("Saved"))
      .catch((err) => toastError("Couldn't save that.", err));
  };
  return (
    <section
      id="videos"
      aria-labelledby="videos-heading"
      className="scroll-mt-24"
    >
      <SectionHeading
        id="videos-heading"
        title="Teaching videos"
        description="A short demo lesson. Admins review each video before it goes live."
        action={
          canAdd ? (
            <AddButton label="Add video" onClick={() => setAdding(true)} />
          ) : undefined
        }
      />
      {blockedText && (
        <div className="mt-5">
          <PausedNotice text={blockedText} note={uploadStatus.data?.note} />
        </div>
      )}
      <div className={cn(card, "mt-5 overflow-hidden")}>
        {videos === null ? (
          loadFailed
        ) : videos.length === 0 ? (
          <EmptyState
            icon={<PlayCircle aria-hidden="true" className="size-5" />}
            title="No videos yet"
            body="Tutors with a demo lesson get more requests."
          />
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-border)]">
            {videos.map((v, i) => {
              const s = VIDEO_STATUS[v.status];
              const saving =
                setHomePage.isPending && setHomePage.variables?.id === v.id;
              return (
                <RemovableRow
                  key={v.id}
                  icon={<PlayCircle aria-hidden="true" className="size-5" />}
                  title={v.title}
                  meta={`Added ${monthYear(v.createdAt)}`}
                  badge={<Pill tone={s.tone}>{s.label}</Pill>}
                  action={
                    <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--color-neutral-charcoal)]">
                      <input
                        type="checkbox"
                        aria-label={`Show on our home page for ${v.title}`}
                        checked={v.showOnHomePage}
                        disabled={saving}
                        onChange={(event) =>
                          saveHomePage(v, event.target.checked)
                        }
                        className={cn(
                          "size-5 shrink-0 accent-[var(--color-primary-core)]",
                          focusRing,
                        )}
                      />
                      Show on our home page
                    </label>
                  }
                  preview={<VideoPreview video={v} />}
                  onRemove={() => onRemove(v.id)}
                  className={enterClass}
                  style={enterStyle(i)}
                />
              );
            })}
          </ul>
        )}
      </div>
      {videos !== null && videos.length > 0 && (
        <p className="mt-3 text-sm text-pretty text-[var(--color-text-secondary)]">
          Ticking it lets admins add the video to our home page. Untick it to
          take it off at once.
        </p>
      )}
      {full && (
        <p className="mt-3 text-sm text-pretty text-[var(--color-text-secondary)]">
          You have {MAX_TUTOR_VIDEOS} videos, the most allowed. Remove one to
          add another.
        </p>
      )}
      {addingMounted && (
        <VideoDialog open={adding} onOpenChange={setAdding} onAdded={onAdded} />
      )}
    </section>
  );
}

function TeachingZonesCard() {
  return (
    <section
      id="teaching-zones"
      aria-labelledby="teaching-zones-heading"
      className="scroll-mt-24"
    >
      <div
        className={cn(
          card,
          "flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-[12px] bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]">
          <MapPin aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1 text-pretty break-words">
          <h2
            id="teaching-zones-heading"
            className="font-semibold text-[var(--color-neutral-charcoal)]"
          >
            Teaching zones
          </h2>
          <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
            Areas where you teach in person. Requirement sets pick from these.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto">
          <Link href="/dashboard/tutor/zones" className={secondaryButton}>
            <LinkPendingLabel>Manage zones</LinkPendingLabel>
          </Link>
        </div>
      </div>
    </section>
  );
}

function FindWorkCard() {
  return (
    <section
      id="find-work"
      aria-labelledby="find-work-heading"
      className="scroll-mt-24"
    >
      <div
        className={cn(
          card,
          "flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-[12px] bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]">
          <Briefcase aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="find-work-heading"
            className="font-semibold text-pretty break-words text-[var(--color-neutral-charcoal)]"
          >
            Find tuitions
          </h2>
          <p className="mt-1 text-sm text-pretty break-words text-[var(--color-text-secondary)]">
            Open requirements near your zones.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto">
          <Link href="/dashboard/find-tuitions" className={primaryButton}>
            <LinkPendingLabel>Find tuitions</LinkPendingLabel>
          </Link>
          <Link href="/dashboard/applications" className={secondaryButton}>
            <LinkPendingLabel>My applications</LinkPendingLabel>
          </Link>
        </div>
      </div>
    </section>
  );
}

function PlacementFeesCard() {
  return (
    <section
      id="placement-fees"
      aria-labelledby="placement-fees-heading"
      className="scroll-mt-24"
    >
      <div
        className={cn(
          card,
          "flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-[12px] bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]">
          <Receipt aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="placement-fees-heading"
            className="font-semibold text-pretty break-words text-[var(--color-neutral-charcoal)]"
          >
            Placement fees
          </h2>
          <p className="mt-1 text-sm text-pretty break-words text-[var(--color-text-secondary)]">
            See what you owe and pay online.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto">
          <Link href="/dashboard/fees" className={secondaryButton}>
            <LinkPendingLabel>View fees</LinkPendingLabel>
          </Link>
        </div>
      </div>
    </section>
  );
}

function ReportsCard() {
  return (
    <section
      id="reports"
      aria-labelledby="reports-heading"
      className="scroll-mt-24"
    >
      <div
        className={cn(
          card,
          "flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-[12px] bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]">
          <Flag aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="reports-heading"
            className="font-semibold text-pretty break-words text-[var(--color-neutral-charcoal)]"
          >
            Reports and disputes
          </h2>
          <p className="mt-1 text-sm text-pretty break-words text-[var(--color-text-secondary)]">
            See what you&apos;ve raised and where it stands.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto">
          <Link href="/dashboard/reports" className={secondaryButton}>
            <LinkPendingLabel>View reports</LinkPendingLabel>
          </Link>
        </div>
      </div>
    </section>
  );
}

function ApplicationsCard() {
  return (
    <section
      id="applications"
      aria-labelledby="applications-heading"
      className="scroll-mt-24"
    >
      <div
        className={cn(
          card,
          "flex flex-col gap-4 p-5 sm:flex-row sm:flex-wrap sm:items-center",
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-[12px] bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]">
          <FileText aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="applications-heading"
            className="font-semibold text-pretty break-words text-[var(--color-neutral-charcoal)]"
          >
            Your applications
          </h2>
          <p className="mt-1 text-sm text-pretty break-words text-[var(--color-text-secondary)]">
            Track the tutors who applied and the packages you requested.
          </p>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto">
          <Link href="/dashboard/applications" className={secondaryButton}>
            <LinkPendingLabel>View applications</LinkPendingLabel>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function StudentReviewsSection({ profileId }: { profileId: string }) {
  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      tabIndex={-1}
      className="scroll-mt-24 outline-none"
    >
      <SectionHeading
        id="reviews-heading"
        title="Reviews about you"
        description="What tutors wrote after working with you. If a review breaks the rules, report it from that application."
        action={
          <Link
            href="/dashboard/applications"
            className={cn(ghostButton, "min-h-10 px-3")}
          >
            <LinkPendingLabel>Your applications</LinkPendingLabel>
          </Link>
        }
      />
      <div className="mt-5">
        <StudentReviewList studentId={profileId} />
      </div>
    </section>
  );
}

function formatShortDate(isoOrDate: string | null): string {
  if (!isoOrDate) return "N/A";
  try {
    const d = new Date(isoOrDate);
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return isoOrDate;
  }
}

export function RequirementsSection({
  requirements,
  onUpdateRequirement,
}: {
  requirements: Requirement[] | null;
  onUpdateRequirement: (req: Requirement) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAllPast, setShowAllPast] = useState(false);
  const reveal = revealMotion(useReducedMotion(), 16);
  const past = requirements?.filter((r) => isPastRequirement(r.status)) ?? [];

  useEffect(() => {
    const posted = searchParams.get("posted");
    const saved = searchParams.get("saved");
    const draft = searchParams.get("draft");

    if (posted || saved || draft) {
      const kind = posted ? "posted" : draft ? "draft" : "saved";
      const message = {
        posted: "Requirement posted",
        draft: "Saved as draft",
        saved: "Changes saved",
      }[kind];

      // One id per message: it stops a double effect from showing the toast twice, and a new
      // message never merges into an earlier one that is fading out (sonner removes both).
      toast.success(message, { id: `requirement-${kind}` });
      router.replace("/dashboard#requirements");
    }
  }, [searchParams, router]);

  return (
    <section
      id="requirements"
      aria-labelledby="requirements-heading"
      tabIndex={-1}
      className="scroll-mt-24 outline-none"
    >
      <SectionHeading
        id="requirements-heading"
        title="Tuition requirements"
        description="What you're looking for. Tutors apply to these."
        action={
          requirements && requirements.length > 0 ? (
            <Link href="/dashboard/requirements/new" className={primaryButton}>
              <LinkPendingLabel>
                <Plus aria-hidden="true" className="size-4" />
                Post a requirement
              </LinkPendingLabel>
            </Link>
          ) : undefined
        }
      />

      {requirements === null ? (
        <div className={cn(card, "mt-5")}>{loadFailed}</div>
      ) : requirements.length === 0 ? (
        <div className={cn(card, "mt-5 p-6")}>
          <EmptyState
            icon={<BookOpen className="size-6" />}
            title="No requirements yet"
            body="Post what you need: subject, class, time and budget. Matching tutors will apply."
          />
          <div className="mt-4 flex justify-center">
            <Link href="/dashboard/requirements/new" className={primaryButton}>
              <LinkPendingLabel>
                <Plus aria-hidden="true" className="size-4" />
                Post your first requirement
              </LinkPendingLabel>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {requirements.filter(
            (r) => r.status === "OPEN" || r.status === "DRAFT",
          ).length > 0 && (
            <ul className="mt-5 grid gap-4">
              {requirements
                .filter((r) => r.status === "OPEN" || r.status === "DRAFT")
                .map((r, i) => (
                  <RequirementItem
                    key={r.id}
                    requirement={r}
                    onUpdateRequirement={onUpdateRequirement}
                    className={enterClass}
                    style={enterStyle(i)}
                  />
                ))}
            </ul>
          )}

          {past.length > 0 && (
            <>
              <h3 className="mt-8 text-sm font-semibold text-[var(--color-text-secondary)]">
                Past requirements
              </h3>
              {/* The newest past card always shows; "View more" opens the rest into place and "Show less" closes them. */}
              <ul id="past-requirements" className="mt-3 flex flex-col">
                <li className={enterClass}>
                  <RequirementItem
                    as="div"
                    requirement={past[0]}
                    onUpdateRequirement={onUpdateRequirement}
                  />
                </li>
                <AnimatePresence initial={false}>
                  {showAllPast &&
                    past.slice(1).map((r) => (
                      <motion.li key={r.id} {...reveal}>
                        <RequirementItem
                          as="div"
                          requirement={r}
                          onUpdateRequirement={onUpdateRequirement}
                        />
                      </motion.li>
                    ))}
                </AnimatePresence>
              </ul>
              {past.length > 1 && (
                <button
                  type="button"
                  aria-expanded={showAllPast}
                  aria-controls="past-requirements"
                  onClick={() => setShowAllPast((v) => !v)}
                  className={cn(ghostButton, "mt-4 min-h-10")}
                >
                  {showAllPast ? "Show less" : "View more"}
                  {showAllPast ? (
                    <ArrowUp aria-hidden="true" className="size-4" />
                  ) : (
                    <ArrowDown aria-hidden="true" className="size-4" />
                  )}
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function RequirementItem({
  requirement: r,
  onUpdateRequirement,
  as: Root = "li",
  className,
  style,
}: {
  requirement: Requirement;
  onUpdateRequirement: (req: Requirement) => void;
  /** "div" when the caller supplies the list item (the past list animates its own items). */
  as?: "li" | "div";
  className?: string;
  style?: React.CSSProperties;
}) {
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");
  const intent = useIntentPrefetch();
  const queryClient = useQueryClient();

  const { subjects } = useSubjects();
  const { areas } = useAreas();
  const subjectName = r.subjectIds.length
    ? r.subjectIds.map((id) => optionName(subjects, id)).join(", ")
    : "Tuition Requirement";
  const { data: lookup } = useEducationLookup();
  const title = `${subjectName} · ${educationSummary(lookup, r) || "Class not set"}`;
  const meta = statusMeta(r.status);
  const isPast = isPastRequirement(r.status);

  const handleClose = async () => {
    setBusy(true);
    try {
      const updated = await requirementApi.close(r.id);
      onUpdateRequirement(updated);
      void invalidateRequirements(queryClient);
      setConfirmingClose(false);
      setAnnounce("Requirement closed.");
      toast.success("Tuition requirement closed");
      requestAnimationFrame(() => {
        document.getElementById(`req-title-${r.id}`)?.focus();
      });
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        onUpdateRequirement({ ...r, status: "CLOSED" });
        void invalidateRequirements(queryClient);
        toast.error("It was already closed.");
      } else {
        toast.error(
          err instanceof Error ? err.message : "Couldn't close requirement.",
        );
      }
      setConfirmingClose(false);
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    setBusy(true);
    try {
      const updated = await requirementApi.update(r.id, { status: "OPEN" });
      onUpdateRequirement(updated);
      void invalidateRequirements(queryClient);
      setAnnounce("Requirement posted.");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't post requirement.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Root
      className={cn(
        card,
        "flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between",
        className,
      )}
      style={style}
    >
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3
            id={`req-title-${r.id}`}
            tabIndex={-1}
            className="font-semibold text-[var(--color-neutral-charcoal)] outline-none"
          >
            {title}
          </h3>
          <Pill tone={meta.tone}>{meta.label}</Pill>
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Posted {formatPostedDate(r.createdAt)}
        </p>

        <ul
          className={cn(
            "mt-3 flex flex-wrap gap-2 transition-opacity duration-150",
            isPast && "opacity-75",
          )}
        >
          {r.areaId && (
            <li className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-sm text-[var(--color-neutral-charcoal)]">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              {optionName(areas, r.areaId)}
            </li>
          )}
          {r.daysPerWeek && (
            <li className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-sm text-[var(--color-neutral-charcoal)]">
              {daysPerWeekLabel(r.daysPerWeek)}
              {r.availableDays !== EVERY_DAY &&
                ` · ${daysLabel(r.availableDays)}`}
            </li>
          )}
          {r.timeOfDay && (
            <li className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-sm text-[var(--color-neutral-charcoal)]">
              {formatTime(r.timeOfDay)}
            </li>
          )}
          {r.salary && (
            <li className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-sm text-[var(--color-neutral-charcoal)]">
              {formatTaka(r.salary)} / month
            </li>
          )}
          {r.tuitionType && (
            <li className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-sm text-[var(--color-neutral-charcoal)]">
              {r.tuitionType}
            </li>
          )}

          {r.studentCount && r.studentCount > 1 && (
            <li className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-sm text-[var(--color-neutral-charcoal)]">
              {r.studentCount} students
            </li>
          )}
          {r.tutorGenderPref === "FEMALE" && (
            <li className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-sm text-[var(--color-neutral-charcoal)]">
              Female tutor
            </li>
          )}
          {r.tutorGenderPref === "MALE" && (
            <li className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-sm text-[var(--color-neutral-charcoal)]">
              Male tutor
            </li>
          )}
          {r.instituteName && (
            <li className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-sm text-[var(--color-neutral-charcoal)]">
              {r.instituteName}
            </li>
          )}
        </ul>

        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          Hire by {formatShortDate(r.hireByDate)}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {confirmingClose ? (
          <div className="flex flex-col gap-2 md:items-end">
            <span className="text-sm font-medium text-[var(--color-neutral-charcoal)]">
              Close this requirement? Tutors won&apos;t be able to apply.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmingClose(false)}
                className={cn(secondaryButton, "min-h-10 px-4")}
              >
                Keep
              </button>
              <button
                type="button"
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={handleClose}
                className={cn(
                  secondaryButton,
                  "min-h-10 bg-[var(--color-semantic-error-surface)] px-4 text-[var(--color-semantic-error-text)] shadow-none hover:bg-[color-mix(in_oklab,var(--color-semantic-error-surface),var(--color-semantic-error-text)_8%)]",
                )}
              >
                <PendingLabel pending={busy}>Yes, close</PendingLabel>
              </button>
            </div>
          </div>
        ) : isPast ? (
          <Link
            href={postAgainHref(r.id)}
            className={cn(secondaryButton, "min-h-10 px-4")}
            {...intent(requirementQueryOptions(r.id))}
          >
            <LinkPendingLabel>
              <Repeat2 aria-hidden="true" className="size-4" />
              Post again<span className="sr-only"> {title}</span>
            </LinkPendingLabel>
          </Link>
        ) : (
          <>
            {r.status === "DRAFT" && (
              <button
                type="button"
                disabled={busy}
                aria-busy={busy || undefined}
                onClick={handlePublish}
                className={cn(secondaryButton, "min-h-10 px-4")}
              >
                <PendingLabel pending={busy}>Post now</PendingLabel>
              </button>
            )}

            <Link
              href={`/dashboard/requirements/${r.id}/edit`}
              className={cn(ghostButton, "min-h-10 px-3")}
            >
              <LinkPendingLabel>
                <Pencil aria-hidden="true" className="size-4" />
                Edit<span className="sr-only"> {title}</span>
              </LinkPendingLabel>
            </Link>

            {r.status !== "DRAFT" && (
              <Link
                href={`/dashboard/requirements/${r.id}/applicants`}
                className={cn(ghostButton, "min-h-10 px-3")}
                {...intent(studentRequirementQueryOptions(r.id))}
              >
                <LinkPendingLabel>
                  <Users aria-hidden="true" className="size-4" />
                  Applicants<span className="sr-only"> {title}</span>
                </LinkPendingLabel>
              </Link>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmingClose(true)}
              className={cn(
                ghostButton,
                "min-h-10 px-3 text-[var(--color-text-secondary)] hover:bg-[var(--color-semantic-error-surface)] hover:text-[var(--color-semantic-error-text)]",
              )}
            >
              <XCircle aria-hidden="true" className="size-4" />
              Close<span className="sr-only"> {title}</span>
            </button>
          </>
        )}
      </div>
    </Root>
  );
}

const PASTELS = [
  "var(--color-secondary-sky)",
  "var(--color-secondary-peach)",
  "var(--color-secondary-lime)",
  "var(--color-secondary-cream)",
];

/** The student's newest OPEN requirement: the one the recommendations are for. */
function newestOpenRequirement(
  requirements: Requirement[] | undefined,
): Requirement | undefined {
  return requirements
    ?.filter((r) => r.status === "OPEN")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

/**
 * Top matches for the student's newest open requirement. `requirements` is the dashboard's own
 * load, so it is not fetched twice; null means that load failed.
 */
export function RecommendedTutors({
  requirements,
  onRetry,
  retrying,
}: {
  requirements: Requirement[] | null;
  onRetry: () => void;
  /** True while the dashboard reloads after Retry. */
  retrying: boolean;
}) {
  const target = newestOpenRequirement(requirements ?? undefined);
  const list = useRecommendedTutors(target?.id ?? "", target !== undefined);
  const tutors = list.data?.pages[0]?.tutors.slice(0, 4) ?? [];

  let body: ReactNode;
  if (requirements === null) {
    body = (
      <ErrorBlock
        message="Couldn't load your requirements."
        onRetry={onRetry}
        retrying={retrying}
      />
    );
  } else if (!target) {
    body = (
      <EmptyCard title="Post a requirement to see matched tutors.">
        <Link
          href="/dashboard/requirements/new"
          className={cn(primaryButton, "justify-self-start")}
        >
          <LinkPendingLabel>Post a requirement</LinkPendingLabel>
        </Link>
      </EmptyCard>
    );
  } else if (list.isPending) {
    body = <RecommendedSkeleton />;
  } else if (list.isError) {
    body = (
      <ErrorBlock
        message="Couldn't load recommended tutors."
        onRetry={() => void list.refetch()}
        retrying={list.isFetching}
      />
    );
  } else if (tutors.length === 0) {
    body = (
      <EmptyCard
        title="No tutors match your open requirement yet."
        body="New tutors show up here when they join."
      />
    );
  } else {
    body = (
      <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {tutors.map((row, i) => (
          <RecommendedTutorCard key={row.tutor.id} row={row} index={i} />
        ))}
      </ul>
    );
  }

  return (
    <section
      id="tutors"
      aria-labelledby="tutors-heading"
      className="scroll-mt-24"
    >
      <SectionHeading
        id="tutors-heading"
        title="Recommended tutors"
        description="Matched to your newest open requirement."
        action={
          <Link
            href="/dashboard/find-tutors"
            className={cn(ghostButton, "min-h-10")}
          >
            <LinkPendingLabel>
              Find tutors
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </LinkPendingLabel>
          </Link>
        }
      />
      <div className="mt-5">{body}</div>
    </section>
  );
}

function RecommendedSkeleton() {
  return (
    <div
      role="status"
      className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4"
    >
      <span className="sr-only">Loading recommended tutors…</span>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn(card, "flex flex-col items-center gap-3 p-5")}
        >
          <Skeleton className="size-16 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40 max-w-full" />
        </div>
      ))}
    </div>
  );
}

function RecommendedTutorCard({
  row,
  index,
}: {
  row: RecommendedTutor;
  index: number;
}) {
  const { tutor } = row;
  const institute = tutor.instituteName?.trim();
  return (
    <li
      className={cn(
        card,
        "relative flex flex-col items-center gap-1 p-5 text-center",
      )}
    >
      <span
        className="mb-2 rounded-full p-1"
        style={{ backgroundColor: PASTELS[index % PASTELS.length] }}
      >
        <UserAvatar src={tutor.avatarUrl} name={tutor.name} size={64} />
      </span>
      <h3 className="font-semibold text-[var(--color-neutral-charcoal)]">
        <Link
          href={`/tutors/${tutor.id}`}
          className={cn(
            "rounded-sm after:absolute after:inset-0 after:rounded-[24px]",
            focusRing,
          )}
        >
          {tutor.name}
        </Link>
        {tutor.verifiedBadge && <VerifiedBadge size={16} className="ms-1.5" />}
      </h3>
      {institute && (
        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
          {institute}
        </p>
      )}
      <span className="mt-1 block">
        <RatingInline
          ratingAvg={tutor.ratingAvg}
          ratingCount={tutor.ratingCount}
        />
      </span>
    </li>
  );
}

/* ───────── Paused uploads ───────── */

/** Static warning that replaces an upload button while an admin has paused that kind of upload. */
/* ───────── Aside ───────── */

function VerificationCard({
  role,
  status,
  note,
  submittedAt,
  hasStudentIdNumber,
  onSubmitted,
}: {
  role: ProfileRole;
  status: VerificationStatus;
  /** The reviewer's note on the latest submission. Shown when rejected. */
  note: string | null;
  submittedAt: string | null;
  hasStudentIdNumber: boolean;
  onSubmitted: (result: SubmittedVerification) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const uploadingMounted = useStayMounted(uploading);
  const uploadStatus = useUploadStatus();
  const v = VERIFICATION[status];
  const canUpload = status === "NOT_SUBMITTED" || status === "REJECTED";
  const blockedText = pausedText(uploadStatus.data, "documents");

  const copy =
    status === "APPROVED"
      ? "Your ID is verified. It counts toward your verified badge."
      : status === "PENDING"
        ? `${submittedAt ? `Sent ${formatShortDate(submittedAt)}. ` : ""}We're reviewing it. This usually takes a day or two.`
        : status === "REJECTED"
          ? "We couldn't accept this ID. Send a new copy to try again."
          : role === "TUTOR"
            ? "Verified tutors appear in the directory. Upload your university ID to get verified."
            : "A verified ID builds trust with tutors. Upload a clear photo or scan of your student ID.";

  return (
    <section
      id="verification"
      aria-labelledby="verification-heading"
      className={cn(card, "scroll-mt-24 p-5")}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-[12px] bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </span>
        <Pill tone={v.tone}>{v.label}</Pill>
      </div>
      <h2
        id="verification-heading"
        className="mt-4 font-semibold text-[var(--color-neutral-charcoal)]"
      >
        {role === "TUTOR" ? "Identity verification" : "Student ID verification"}
      </h2>
      <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
        {copy}
      </p>
      {status === "REJECTED" && (
        <p className="mt-3 rounded-[12px] bg-[var(--color-semantic-error-surface)] px-3 py-2 text-sm text-pretty text-[var(--color-semantic-error-text)]">
          {note
            ? `Reviewer note: ${note}`
            : "An admin rejected this ID. Upload a new one."}
        </p>
      )}
      {canUpload &&
        (blockedText ? (
          <div className="mt-4">
            <PausedNotice text={blockedText} note={uploadStatus.data?.note} />
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setUploading(true)}
              className={primaryButton}
            >
              <Upload aria-hidden="true" className="size-4" />
              Upload ID
            </button>
          </div>
        ))}
      {uploadingMounted && (
        <VerificationUploadDialog
          open={uploading}
          onOpenChange={setUploading}
          role={role}
          hasStudentIdNumber={hasStudentIdNumber}
          onSubmitted={onSubmitted}
        />
      )}
    </section>
  );
}

function AccountCard({
  email,
  since,
  phone,
  phoneVerifiedAt,
  onVerifyPhone,
  whatsapp,
  whatsappVerified,
  featureFlags,
}: {
  email: string;
  since: string;
  phone: string;
  phoneVerifiedAt: string | null;
  onVerifyPhone: () => void;
  whatsapp: string | null;
  whatsappVerified: boolean;
  featureFlags: FeatureFlags;
}) {
  return (
    <section aria-labelledby="account-heading" className={cn(card, "p-5")}>
      <h2
        id="account-heading"
        className="font-semibold text-[var(--color-neutral-charcoal)]"
      >
        Account
      </h2>
      <dl className="mt-4 grid gap-4 text-sm">
        <div className="min-w-0">
          <dt className="text-[var(--color-text-secondary)]">Google account</dt>
          <dd className="mt-0.5 font-medium break-all text-[var(--color-neutral-charcoal)]">
            {email}
          </dd>
        </div>
        <div id="phone-verification" className="scroll-mt-24">
          <dt className="text-[var(--color-text-secondary)]">Phone number</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2 font-medium text-[var(--color-neutral-charcoal)]">
            <span className="tabular-nums">{formatBdPhone(phone)}</span>
            <Badge
              className={cn(
                "px-2",
                phoneVerifiedAt
                  ? "bg-[var(--color-semantic-success-surface)] text-[var(--color-semantic-success-text)]"
                  : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]",
              )}
            >
              {phoneVerifiedAt ? "Verified" : "Not verified"}
            </Badge>
            {!phoneVerifiedAt && (
              <button
                type="button"
                onClick={onVerifyPhone}
                className={cn(secondaryButton, "min-h-9 px-4")}
              >
                Verify
              </button>
            )}
          </dd>
        </div>
        {whatsapp && (
          <div>
            <dt className="text-[var(--color-text-secondary)]">WhatsApp</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-2 font-medium text-[var(--color-neutral-charcoal)]">
              <span className="tabular-nums">{formatBdPhone(whatsapp)}</span>
              <Pill tone={whatsappVerified ? "success" : "neutral"}>
                {whatsappVerified ? "Verified" : "Not verified"}
              </Pill>
            </dd>
          </div>
        )}
        <div>
          <dt className="text-[var(--color-text-secondary)]">Member since</dt>
          <dd className="mt-0.5 font-medium text-[var(--color-neutral-charcoal)]">
            {monthYear(since)}
          </dd>
        </div>
      </dl>
      {isFeatureEnabled("DELETE_ACCOUNT", featureFlags) && (
        <div className="mt-5 border-t border-[var(--color-neutral-border)] pt-5">
          <DeleteAccountButton />
        </div>
      )}
    </section>
  );
}

function HelpCard() {
  return (
    <section
      aria-labelledby="help-heading"
      className="relative overflow-hidden rounded-[24px] bg-[var(--color-surface-inverse)] p-5 text-[var(--color-neutral-white)]"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--color-mesh-deep)_70%,transparent),transparent)]"
      />
      <MessageCircle aria-hidden="true" className="relative size-6" />
      <h2 id="help-heading" className="relative mt-3 font-semibold">
        Need a hand?
      </h2>
      <p className="relative mt-1 text-sm text-pretty text-[var(--color-neutral-white)]/80">
        Read how matching, fees and verification work.
      </p>
      <Link
        href="/#faq"
        className={cn(
          "relative mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--color-neutral-white)] px-4 text-sm font-semibold text-[var(--color-neutral-charcoal)] transition-[background-color,scale] duration-150 ease-out hover:bg-[var(--color-secondary-sky)] active:scale-[0.96]",
          focusRing,
          "focus-visible:outline-[var(--color-neutral-white)]",
        )}
      >
        Read the FAQ
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}

/* ───────── Loading ───────── */

function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="mx-auto w-full max-w-6xl px-4 pt-12 sm:px-6"
    >
      <span className="sr-only">Loading your profile</span>
      <div className="flex items-center gap-5">
        <Skeleton className="size-24 rounded-full" />
        <div className="grid flex-1 gap-3">
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="h-8 w-64 max-w-full rounded-full" />
          <Skeleton className="h-5 w-48 rounded-full" />
        </div>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 rounded-[20px]" />
        ))}
      </div>
      <div className="mt-10 grid gap-4">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-48 rounded-[24px]" />
        ))}
      </div>
    </div>
  );
}
