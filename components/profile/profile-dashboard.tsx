"use client";

import { Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  CalendarDays,
  Check,
  Eye,
  FileText,
  MapPin,
  MessageCircle,
  Package,
  Pencil,
  PlayCircle,
  Plus,
  RotateCw,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import type { UserSession } from "@/lib/auth";
import { tutors as sampleTutors } from "@/lib/tutors";
import { cn } from "@/lib/utils";
import {
  AREAS,
  ApiError,
  SECTIONS,
  SUBJECTS,
  clearSession,
  formatBdPhone,
  formFromProfile,
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
  type Verification,
  type VerificationStatus,
  type Video,
} from "@/lib/profile";
import {
  classLabel,
  formatTaka,
  formatTime,
  requirementApi,
  statusMeta,
  type Requirement,
} from "@/lib/requirements";
import { isFeatureEnabled, type FeatureFlags } from "@/lib/features";
import { DeleteAccountButton } from "@/components/auth/delete-account-button";
import { LogoutButton } from "@/components/auth/logout-button";
import { EditSection } from "./edit-section";
import { FieldError } from "./profile-fields";
import {
  card,
  focusRing,
  ghostButton,
  primaryButton,
  secondaryButton,
} from "./styles";

const WASH = [
  "radial-gradient(55% 80% at 0% 0%, color-mix(in oklab, var(--color-primary-core) 18%, transparent), transparent 70%)",
  "radial-gradient(45% 70% at 100% 0%, color-mix(in oklab, var(--color-mesh-glow) 50%, transparent), transparent 70%)",
  "radial-gradient(40% 60% at 70% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

type Tone = "success" | "warning" | "error" | "neutral" | "info";

const TONE: Record<Tone, string> = {
  success:
    "bg-[var(--color-semantic-success-surface)] text-[var(--color-semantic-success-text)]",
  warning:
    "bg-[var(--color-semantic-warning-surface)] text-[var(--color-semantic-warning-text)]",
  error:
    "bg-[var(--color-semantic-error-surface)] text-[var(--color-semantic-error-text)]",
  neutral:
    "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]",
  info: "bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]",
};

const VERIFICATION: Record<VerificationStatus, { tone: Tone; label: string }> =
  {
    NOT_SUBMITTED: { tone: "neutral", label: "Not verified" },
    PENDING: { tone: "warning", label: "Under review" },
    APPROVED: { tone: "success", label: "Verified" },
    REJECTED: { tone: "error", label: "Rejected" },
  };

const VIDEO_STATUS: Record<Video["status"], { tone: Tone; label: string }> = {
  PENDING: { tone: "warning", label: "In review" },
  APPROVED: { tone: "success", label: "Live" },
  REJECTED: { tone: "error", label: "Rejected" },
};

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

async function loadDashboard(): Promise<LoadResult> {
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

  useEffect(() => {
    let live = true;
    loadDashboard()
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
      })
      .catch((err) => {
        if (live)
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load your profile.",
          );
      });
    return () => {
      live = false;
    };
  }, [router, attempt]);

  const role = session.role as ProfileRole;
  const profile = me && profileOf(me);

  const saveSection = async (next: ProfileForm, fields: FieldDef[]) => {
    if (!me) return;
    const keys = fields.map((f) => f.key);
    const body = toPayload(role, next, keys);
    if (Object.keys(body).length) {
      const updated = await profileApi.update(role, body);
      setMe(
        (m) =>
          m &&
          (role === "STUDENT"
            ? { ...m, student: { ...m.student!, ...updated } }
            : { ...m, tutor: { ...m.tutor!, ...updated } }),
      );
    }
    if (role === "TUTOR") await saveTutorLists(next, keys);
    setForm(
      (f) =>
        f && { ...f, ...Object.fromEntries(keys.map((k) => [k, next[k]])) },
    );
  };

  const removeCredential = async (id: string) => {
    await profileApi.deleteCredential(id);
    setTutorData((d) => ({
      ...d,
      credentials: d.credentials?.filter((c) => c.id !== id) ?? null,
    }));
  };

  const removeVideo = async (id: string) => {
    await profileApi.deleteVideo(id);
    setTutorData((d) => ({
      ...d,
      videos: d.videos?.filter((v) => v.id !== id) ?? null,
    }));
  };

  const displayName = profile?.name || session.name || "there";

  return (
    <div className="min-h-dvh bg-[var(--color-neutral-off-white)]">
      <TopBar name={displayName} picture={session.picture} />

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
              onClick={() => {
                setLoadError(null);
                setAttempt((a) => a + 1);
              }}
              className={cn(primaryButton, "mt-6")}
            >
              <RotateCw aria-hidden="true" className="size-4" />
              Try again
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
            profile={profile}
            areaLabel={
              me.student
                ? optionName(AREAS, me.student.areaId)
                : form.areaIds.length
                  ? `${form.areaIds.length} area${form.areaIds.length > 1 ? "s" : ""}`
                  : null
            }
            checklist={checklist(role, me, form, tutorData)}
          />

          <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
            <Stats
              role={role}
              rating={Number(profile.ratingAvg)}
              ratingCount={profile.ratingCount}
              openRequirementsCount={
                studentData.requirements?.filter((r) => r.status === "OPEN")
                  .length ?? null
              }
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
                  <div className="mt-5 grid gap-4">
                    {SECTIONS[role].map((section) => (
                      <EditSection
                        key={section.id}
                        section={section}
                        values={form}
                        onSave={saveSection}
                      />
                    ))}
                  </div>
                </section>

                {role === "TUTOR" ? (
                  <>
                    <CredentialsSection
                      credentials={tutorData.credentials}
                      onRemove={removeCredential}
                    />
                    <VideosSection
                      videos={tutorData.videos}
                      onRemove={removeVideo}
                    />
                    <PackagesSection />
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
                    <RecommendedTutors />
                  </>
                )}
              </div>

              <aside className="grid content-start gap-4" aria-label="Account">
                <VerificationCard
                  role={role}
                  status={profile.verificationStatus}
                  latest={tutorData.verifications?.[0] ?? null}
                />
                <AccountCard
                  email={me.email}
                  since={me.createdAt}
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
    </div>
  );
}

/* ───────── Chrome ───────── */

function TopBar({ name, picture }: { name: string; picture?: string }) {
  return (
    <header className="sticky top-0 z-40 bg-[color-mix(in_oklab,var(--color-neutral-white)_85%,transparent)] shadow-[0_1px_0_rgb(0_0_0/0.06)] backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className={cn("rounded-lg", focusRing)}>
          <Image
            src="/assets/ic-demo/Icon-blue.png"
            alt="Masters Hub home"
            width={860}
            height={220}
            priority
            className="h-9 w-auto"
          />
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 sm:flex">
            <Avatar name={name} picture={picture} size={32} />
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

function Avatar({
  name,
  picture,
  size,
  className,
}: {
  name: string;
  picture?: string;
  size: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return picture ? (
    <Image
      src={picture}
      alt=""
      width={size}
      height={size}
      unoptimized
      referrerPolicy="no-referrer"
      className={cn(
        "shrink-0 rounded-full object-cover outline-1 -outline-offset-1 outline-[oklch(0_0_0/0.1)]",
        className,
      )}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary-sky)] font-semibold text-[var(--color-primary-deep)]",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || "?"}
    </span>
  );
}

function Pill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

function SampleTag() {
  return (
    <span className="rounded-full bg-[var(--color-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
      Sample data
    </span>
  );
}

function SectionHeading({
  id,
  title,
  description,
  sample,
  action,
}: {
  id: string;
  title: string;
  description?: string;
  sample?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id={id}
            className="text-xl font-semibold tracking-tight text-[var(--color-neutral-charcoal)] sm:text-2xl"
          >
            {title}
          </h2>
          {sample && <SampleTag />}
        </div>
        {description && (
          <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/* ───────── Hero ───────── */

interface CheckItem {
  label: string;
  done: boolean;
  note?: string;
}

function checklist(
  role: ProfileRole,
  me: Me,
  form: ProfileForm,
  data: TutorData,
): CheckItem[] {
  const profile = profileOf(me)!;
  const items: CheckItem[] = [
    { label: "Profile details", done: true },
    {
      label: "WhatsApp verified",
      done: !!profile.whatsappVerifiedAt,
      note: "Coming soon",
    },
    {
      label: role === "TUTOR" ? "Identity verified" : "Student ID verified",
      done: profile.verificationStatus === "APPROVED",
      note:
        profile.verificationStatus === "PENDING"
          ? "Under review"
          : "Coming soon",
    },
  ];
  if (role === "TUTOR")
    items.splice(
      1,
      0,
      {
        label: "Subjects and areas",
        done: form.subjectIds.length > 0 && form.areaIds.length > 0,
      },
      {
        label: "Exam credentials",
        done: (data.credentials?.length ?? 0) > 0,
        note: "Coming soon",
      },
    );
  return items;
}

function Hero({
  role,
  name,
  picture,
  profile,
  areaLabel,
  checklist,
}: {
  role: ProfileRole;
  name: string;
  picture?: string;
  profile: NonNullable<ReturnType<typeof profileOf>>;
  areaLabel: string | null;
  checklist: CheckItem[];
}) {
  const done = checklist.filter((c) => c.done).length;
  const pct = Math.round((done / checklist.length) * 100);
  const v = VERIFICATION[profile.verificationStatus];

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
          <Avatar
            name={name}
            picture={picture}
            size={96}
            className="shadow-[0_0_0_4px_var(--color-neutral-white),0_12px_32px_-8px_rgb(0_0_0/0.25)]"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-primary-deep)]">
              {role === "TUTOR" ? "Tutor dashboard" : "Student dashboard"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight break-words text-[var(--color-neutral-charcoal)] sm:text-4xl">
              {name}
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
            </div>
          </div>
        </div>

        <div className="rounded-[24px] bg-[color-mix(in_oklab,var(--color-neutral-white)_80%,transparent)] p-5 shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_12px_32px_-12px_rgb(0_0_0/0.12)] backdrop-blur-md">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--color-neutral-charcoal)]">
              Profile strength
            </h2>
            <span className="text-2xl font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
              {pct}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Profile strength"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-3 h-2 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--color-neutral-charcoal)_10%,transparent)]"
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg_in_oklab,var(--color-primary-core),var(--color-mesh-deep))]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <ul className="mt-4 grid gap-2">
            {checklist.map((item) => (
              <li
                key={item.label}
                className="flex items-center gap-2.5 text-sm"
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    item.done
                      ? "bg-[var(--color-primary-core)] text-[var(--color-neutral-white)]"
                      : "shadow-[inset_0_0_0_1.5px_var(--color-border-control)]",
                  )}
                >
                  {item.done && (
                    <Check
                      aria-hidden="true"
                      className="size-3"
                      strokeWidth={3}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1",
                    item.done
                      ? "text-[var(--color-neutral-charcoal)]"
                      : "text-[var(--color-text-secondary)]",
                  )}
                >
                  {item.label}
                  <span className="sr-only">
                    {item.done ? ": done" : ": to do"}
                  </span>
                </span>
                {!item.done && item.note && (
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {item.note}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ───────── Stats ───────── */

function Stats({
  role,
  rating,
  ratingCount,
  openRequirementsCount,
}: {
  role: ProfileRole;
  rating: number;
  ratingCount: number;
  openRequirementsCount?: number | null;
}) {
  const ratingTile = {
    icon: Star,
    label: ratingCount ? `Rating · ${ratingCount} reviews` : "Rating",
    value: ratingCount ? rating.toFixed(1) : "No reviews yet",
    bg: "var(--color-secondary-cream)",
    live: true,
  };
  // shortcut: sample numbers until the applications/requirements screens exist.
  const tiles =
    role === "TUTOR"
      ? [
          {
            icon: Briefcase,
            label: "Applications sent",
            value: "12",
            bg: "var(--color-secondary-sky)",
          },
          {
            icon: Users,
            label: "Active students",
            value: "3",
            bg: "var(--color-secondary-lime)",
          },
          {
            icon: Eye,
            label: "Profile views",
            value: "248",
            bg: "var(--color-secondary-peach)",
          },
          ratingTile,
        ]
      : [
          {
            icon: BookOpen,
            label: "Open requirements",
            value:
              openRequirementsCount !== null &&
              openRequirementsCount !== undefined
                ? String(openRequirementsCount)
                : "0",
            bg: "var(--color-secondary-sky)",
            live: true,
          },
          {
            icon: Briefcase,
            label: "Applications received",
            value: "7",
            bg: "var(--color-secondary-lime)",
          },
          {
            icon: Users,
            label: "Tutors hired",
            value: "1",
            bg: "var(--color-secondary-peach)",
          },
          ratingTile,
        ];

  return (
    <section aria-labelledby="stats-heading" className="-mt-2">
      <h2 id="stats-heading" className="sr-only">
        At a glance
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ icon: Icon, label, value, bg, ...rest }) => (
          <li
            key={label}
            className="relative flex min-h-32 flex-col justify-between gap-4 rounded-[20px] p-4 sm:p-5"
            style={{ backgroundColor: bg }}
          >
            <span className="flex items-start justify-between gap-2">
              <span className="flex size-9 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-neutral-white)_70%,transparent)] text-[var(--color-neutral-charcoal)]">
                <Icon aria-hidden="true" className="size-[18px]" />
              </span>
              {!("live" in rest) && (
                <span className="text-[11px] font-medium text-[var(--color-neutral-charcoal)]/75">
                  Sample
                </span>
              )}
            </span>
            <span>
              <span
                className={cn(
                  "block font-semibold tracking-tight text-[var(--color-neutral-charcoal)] tabular-nums",
                  value.length > 4 ? "text-base" : "text-3xl",
                )}
              >
                {value}
              </span>
              <span className="mt-0.5 block text-sm text-[var(--color-neutral-charcoal)]/80">
                {label}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────── Tutor sections (live) ───────── */

function RemovableRow({
  icon,
  title,
  meta,
  badge,
  onRemove,
}: {
  icon: React.ReactNode;
  title: string;
  meta?: string;
  badge?: React.ReactNode;
  onRemove: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:px-5">
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
        {error && (
          <span
            role="alert"
            className="block text-sm font-medium text-[var(--color-semantic-error-text)]"
          >
            {error}
          </span>
        )}
      </span>
      {badge}
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
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onRemove();
              } catch (err) {
                setError(
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
            {busy ? "Removing…" : "Yes, remove"}
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

function UploadSoon({ label }: { label: string }) {
  return (
    <button type="button" disabled className={cn(secondaryButton, "min-h-10")}>
      <Upload aria-hidden="true" className="size-4" />
      {label}
      <span className="rounded-full bg-[var(--color-surface-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
        Soon
      </span>
    </button>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--color-secondary-sky)] text-[var(--color-primary-deep)]">
        {icon}
      </span>
      <p className="mt-1 font-semibold text-[var(--color-neutral-charcoal)]">
        {title}
      </p>
      <p className="max-w-sm text-sm text-pretty text-[var(--color-text-secondary)]">
        {body}
      </p>
    </div>
  );
}

const loadFailed = (
  <p className="px-6 py-10 text-center text-sm text-[var(--color-text-secondary)]">
    Couldn&apos;t load this list. Refresh the page to try again.
  </p>
);

function CredentialsSection({
  credentials,
  onRemove,
}: {
  credentials: Credential[] | null;
  onRemove: (id: string) => Promise<void>;
}) {
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
        action={<UploadSoon label="Add credential" />}
      />
      <div className={cn(card, "mt-5 overflow-hidden")}>
        {credentials === null ? (
          loadFailed
        ) : credentials.length === 0 ? (
          <EmptyState
            icon={<FileText aria-hidden="true" className="size-5" />}
            title="No credentials yet"
            body="Uploading result sheets is coming soon. You'll be able to add them here."
          />
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-border)]">
            {credentials.map((c) => (
              <RemovableRow
                key={c.id}
                icon={<FileText aria-hidden="true" className="size-5" />}
                title={c.examLabel}
                meta={`Result: ${c.result}`}
                onRemove={() => onRemove(c.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function VideosSection({
  videos,
  onRemove,
}: {
  videos: Video[] | null;
  onRemove: (id: string) => Promise<void>;
}) {
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
        action={<UploadSoon label="Add video" />}
      />
      <div className={cn(card, "mt-5 overflow-hidden")}>
        {videos === null ? (
          loadFailed
        ) : videos.length === 0 ? (
          <EmptyState
            icon={<PlayCircle aria-hidden="true" className="size-5" />}
            title="No videos yet"
            body="Video uploads are coming soon. Tutors with a demo lesson get more requests."
          />
        ) : (
          <ul className="divide-y divide-[var(--color-neutral-border)]">
            {videos.map((v) => {
              const s = VIDEO_STATUS[v.status];
              return (
                <RemovableRow
                  key={v.id}
                  icon={<PlayCircle aria-hidden="true" className="size-5" />}
                  title={v.title}
                  meta={`Added ${monthYear(v.createdAt)}`}
                  badge={<Pill tone={s.tone}>{s.label}</Pill>}
                  onRemove={() => onRemove(v.id)}
                />
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ───────── Sample sections ───────── */

// shortcut: static placeholders until packages/requirements screens are built.
const PACKAGES = [
  {
    name: "SSC Booster",
    body: "Full syllabus revision with weekly mock exams and guardian reports.",
    seats: "3–5 students",
    price: "৳6,500 / month",
    tone: "info" as Tone,
    status: "Open",
    bg: "var(--color-secondary-sky)",
  },
  {
    name: "HSC Physics Prep",
    body: "Chapter tests, doubt-clearing sessions and past papers.",
    seats: "3–5 students",
    price: "৳7,500 / month",
    tone: "warning" as Tone,
    status: "In review",
    bg: "var(--color-secondary-peach)",
  },
];

function PackagesSection() {
  return (
    <section
      id="packages"
      aria-labelledby="packages-heading"
      className="scroll-mt-24"
    >
      <SectionHeading
        id="packages-heading"
        title="Your tuition packages"
        description="Fixed packages students can join directly."
        sample
      />
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {PACKAGES.map((p) => (
          <li key={p.name} className={cn(card, "flex flex-col gap-3 p-5")}>
            <div className="flex items-start justify-between gap-3">
              <span
                className="flex size-11 items-center justify-center rounded-[14px] text-[var(--color-neutral-charcoal)]"
                style={{ backgroundColor: p.bg }}
              >
                <Package aria-hidden="true" className="size-5" />
              </span>
              <Pill tone={p.tone}>{p.status}</Pill>
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-neutral-charcoal)]">
              {p.name}
            </h3>
            <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
              {p.body}
            </p>
            <div className="mt-auto flex items-end justify-between gap-3 pt-2">
              <span className="text-sm text-[var(--color-text-secondary)]">
                {p.seats}
              </span>
              <span className="font-semibold text-[var(--color-neutral-charcoal)] tabular-nums">
                {p.price}
              </span>
            </div>
          </li>
        ))}
      </ul>
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

function RequirementsSection({
  requirements,
  onUpdateRequirement,
}: {
  requirements: Requirement[] | null;
  onUpdateRequirement: (req: Requirement) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [banner, setBanner] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const posted = searchParams.get("posted");
    const saved = searchParams.get("saved");
    const draft = searchParams.get("draft");

    if (posted || saved || draft) {
      const message = posted
        ? "Requirement posted"
        : draft
          ? "Saved as draft"
          : "Changes saved";

      void Promise.resolve().then(() => setBanner(message));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => {
      setBanner(null);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (
          params.has("posted") ||
          params.has("saved") ||
          params.has("draft")
        ) {
          router.replace("/dashboard#requirements");
        }
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [banner, router]);

  return (
    <section
      id="requirements"
      aria-labelledby="requirements-heading"
      className="scroll-mt-24"
    >
      <SectionHeading
        id="requirements-heading"
        title="Tuition requirements"
        description="What you're looking for. Tutors apply to these."
        action={
          requirements && requirements.length > 0 ? (
            <Link href="/dashboard/requirements/new" className={primaryButton}>
              <Plus aria-hidden="true" className="size-4" />
              Post a requirement
            </Link>
          ) : undefined
        }
      />

      <p aria-live="polite" className="empty:hidden">
        {banner && (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-semantic-success-surface)] px-3 py-1 text-sm font-medium text-[var(--color-semantic-success-text)]">
            <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
            {banner}
          </span>
        )}
      </p>

      {actionError && (
        <div
          role="alert"
          className="mt-3 rounded-[12px] bg-[var(--color-semantic-error-surface)] px-4 py-3"
        >
          <FieldError message={actionError} />
        </div>
      )}

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
              <Plus aria-hidden="true" className="size-4" />
              Post your first requirement
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
                .map((r) => (
                  <RequirementItem
                    key={r.id}
                    requirement={r}
                    onUpdateRequirement={onUpdateRequirement}
                    setActionError={setActionError}
                  />
                ))}
            </ul>
          )}

          {requirements.filter(
            (r) => r.status !== "OPEN" && r.status !== "DRAFT",
          ).length > 0 && (
            <>
              <h3 className="mt-8 text-sm font-semibold text-[var(--color-text-secondary)]">
                Past requirements
              </h3>
              <ul className="mt-3 grid gap-4">
                {requirements
                  .filter((r) => r.status !== "OPEN" && r.status !== "DRAFT")
                  .map((r) => (
                    <RequirementItem
                      key={r.id}
                      requirement={r}
                      onUpdateRequirement={onUpdateRequirement}
                      setActionError={setActionError}
                    />
                  ))}
              </ul>
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
  setActionError,
}: {
  requirement: Requirement;
  onUpdateRequirement: (req: Requirement) => void;
  setActionError: (msg: string | null) => void;
}) {
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState("");

  const subjectName = r.subjectId
    ? optionName(SUBJECTS, r.subjectId)
    : "Tuition Requirement";
  const title = `${subjectName} · ${classLabel(r.classLevel)}`;
  const meta = statusMeta(r.status);
  const isPast = r.status !== "OPEN" && r.status !== "DRAFT";

  const handleClose = async () => {
    setBusy(true);
    setActionError(null);
    try {
      const updated = await requirementApi.close(r.id);
      onUpdateRequirement(updated);
      setConfirmingClose(false);
      setAnnounce("Requirement closed.");
      requestAnimationFrame(() => {
        document.getElementById(`req-title-${r.id}`)?.focus();
      });
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        onUpdateRequirement({ ...r, status: "CLOSED" });
        setActionError("It was already closed.");
      } else {
        setActionError(
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
    setActionError(null);
    try {
      const updated = await requirementApi.update(r.id, { status: "OPEN" });
      onUpdateRequirement(updated);
      setAnnounce("Requirement posted.");
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Couldn't post requirement.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={cn(
        card,
        "flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between",
      )}
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

        <ul
          className={cn(
            "mt-3 flex flex-wrap gap-2 transition-opacity duration-150",
            isPast && "opacity-75",
          )}
        >
          {r.areaId && (
            <li className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-sm text-[var(--color-neutral-charcoal)]">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              {optionName(AREAS, r.areaId)}
            </li>
          )}
          {r.daysPerWeek && (
            <li className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-sm text-[var(--color-neutral-charcoal)]">
              {r.daysPerWeek} {r.daysPerWeek === 1 ? "day" : "days"} a week
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
          Hire by {formatShortDate(r.hireByDate)} · Posted{" "}
          {formatShortDate(r.createdAt)}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {confirmingClose ? (
          <div className="flex flex-col gap-2 sm:items-end">
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
                onClick={handleClose}
                className={cn(
                  secondaryButton,
                  "min-h-10 bg-[var(--color-semantic-error-surface)] px-4 text-[var(--color-semantic-error-text)] shadow-none hover:bg-[color-mix(in_oklab,var(--color-semantic-error-surface),var(--color-semantic-error-text)_8%)]",
                )}
              >
                {busy ? "Closing…" : "Yes, close"}
              </button>
            </div>
          </div>
        ) : !isPast ? (
          <>
            {r.status === "DRAFT" && (
              <button
                type="button"
                disabled={busy}
                onClick={handlePublish}
                className={cn(secondaryButton, "min-h-10 px-4")}
              >
                {busy ? "Posting…" : "Post now"}
              </button>
            )}

            <Link
              href={`/dashboard/requirements/${r.id}/edit`}
              className={cn(ghostButton, "min-h-10 px-3")}
            >
              <Pencil aria-hidden="true" className="size-4" />
              Edit<span className="sr-only"> {title}</span>
            </Link>

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
        ) : null}
      </div>
    </li>
  );
}

const PASTELS = [
  "var(--color-secondary-sky)",
  "var(--color-secondary-peach)",
  "var(--color-secondary-lime)",
  "var(--color-secondary-cream)",
];

function RecommendedTutors() {
  return (
    <section
      id="tutors"
      aria-labelledby="tutors-heading"
      className="scroll-mt-24"
    >
      <SectionHeading
        id="tutors-heading"
        title="Recommended tutors"
        description="Matched to your area and subjects."
        sample
        action={
          <Link href="/#tutors" className={cn(ghostButton, "min-h-10")}>
            Browse all
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        }
      />
      <ul className="mt-5 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4">
        {sampleTutors.slice(0, 4).map((t, i) => (
          <li
            key={t.id}
            className={cn(
              card,
              "flex flex-col items-center gap-1 p-5 text-center",
            )}
          >
            <span
              className="mb-2 rounded-full p-1"
              style={{ backgroundColor: PASTELS[i % PASTELS.length] }}
            >
              <Image
                src={t.avatar}
                alt=""
                width={64}
                height={64}
                className="size-16 rounded-full outline-1 -outline-offset-1 outline-[oklch(0_0_0/0.1)]"
              />
            </span>
            <h3 className="font-semibold text-[var(--color-neutral-charcoal)]">
              {t.name}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t.position}
            </p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--color-neutral-charcoal)]">
              <Star
                aria-hidden="true"
                className="size-4 fill-[var(--color-semantic-warning)] text-[var(--color-semantic-warning)]"
              />
              <span className="font-semibold tabular-nums">
                {t.rating.toFixed(1)}
              </span>
              <span className="text-[var(--color-text-secondary)]">
                ({t.reviews} reviews)
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────── Aside ───────── */

function VerificationCard({
  role,
  status,
  latest,
}: {
  role: ProfileRole;
  status: VerificationStatus;
  latest: Verification | null;
}) {
  const v = VERIFICATION[status];
  return (
    <section aria-labelledby="verification-heading" className={cn(card, "p-5")}>
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
        {status === "APPROVED"
          ? "You're verified. Your badge shows on your profile."
          : status === "PENDING"
            ? "We're reviewing your ID. This usually takes a day or two."
            : role === "TUTOR"
              ? "Verified tutors appear in the directory. ID upload is coming soon."
              : "A verified ID builds trust with tutors. ID upload is coming soon."}
      </p>
      {latest?.status === "REJECTED" && latest.note && (
        <p className="mt-3 rounded-[12px] bg-[var(--color-semantic-error-surface)] px-3 py-2 text-sm text-[var(--color-semantic-error-text)]">
          Reviewer note: {latest.note}
        </p>
      )}
      <div className="mt-4">
        <UploadSoon label="Upload ID card" />
      </div>
    </section>
  );
}

function AccountCard({
  email,
  since,
  whatsapp,
  whatsappVerified,
  featureFlags,
}: {
  email: string;
  since: string;
  whatsapp: string;
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
        <div>
          <dt className="text-[var(--color-text-secondary)]">WhatsApp</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-2 font-medium text-[var(--color-neutral-charcoal)]">
            <span className="tabular-nums">{formatBdPhone(whatsapp)}</span>
            <Pill tone={whatsappVerified ? "success" : "neutral"}>
              {whatsappVerified ? "Verified" : "Not verified"}
            </Pill>
          </dd>
        </div>
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
  const bar =
    "animate-pulse rounded-full bg-[color-mix(in_oklab,var(--color-neutral-charcoal)_8%,transparent)] motion-reduce:animate-none";
  return (
    <div
      aria-busy="true"
      aria-label="Loading your profile"
      className="mx-auto w-full max-w-6xl px-4 pt-12 sm:px-6"
    >
      <div className="flex items-center gap-5">
        <div className={cn(bar, "size-24")} />
        <div className="grid flex-1 gap-3">
          <div className={cn(bar, "h-4 w-32")} />
          <div className={cn(bar, "h-8 w-64 max-w-full")} />
          <div className={cn(bar, "h-5 w-48")} />
        </div>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn(bar, "h-32 rounded-[20px]")} />
        ))}
      </div>
      <div className="mt-10 grid gap-4">
        {[0, 1].map((i) => (
          <div key={i} className={cn(bar, "h-48 rounded-[24px]")} />
        ))}
      </div>
    </div>
  );
}
