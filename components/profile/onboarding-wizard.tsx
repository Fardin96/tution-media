"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { BlockingOverlay } from "@/components/ui/blocking-overlay";
import { PendingLabel } from "@/components/ui/pending-label";
import { cn } from "@/lib/utils";
import {
  usePhoneVerificationStatus,
  verifiedAtFor,
} from "@/lib/phone-verification";
import {
  ApiError,
  SECTIONS,
  clearSession,
  conflictField,
  emptyForm,
  normalizeBdPhone,
  profileApi,
  profileOf,
  saveTutorLists,
  toPayload,
  validate,
  type FormErrors,
  type ProfileForm,
  type ProfileRole,
  type Section,
} from "@/lib/profile";
import { PhoneVerificationPanel } from "./phone-verification-panel";
import { ProfileFields } from "./profile-fields";
import { card, ghostButton, primaryButton, secondaryButton } from "./styles";

const WASH = [
  "radial-gradient(60% 50% at 10% 0%, color-mix(in oklab, var(--color-primary-core) 16%, transparent), transparent 70%)",
  "radial-gradient(50% 40% at 95% 10%, color-mix(in oklab, var(--color-mesh-glow) 45%, transparent), transparent 70%)",
  "radial-gradient(40% 40% at 80% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

const VERIFY_ID = "verify";

const VERIFY_STEP: Section = {
  id: VERIFY_ID,
  title: "Verify phone",
  description: "Confirm the number on your profile with a code we text you.",
  fields: [],
};

/** The role's steps, with the phone check right after the contact step. */
function stepsWithVerify(role: ProfileRole): Section[] {
  const base = SECTIONS[role];
  const at = base.findIndex((s) => s.id === "contact") + 1;
  return [...base.slice(0, at), VERIFY_STEP, ...base.slice(at)];
}

const STEPS: Record<ProfileRole, Section[]> = {
  STUDENT: stepsWithVerify("STUDENT"),
  TUTOR: stepsWithVerify("TUTOR"),
};

// One error toast at a time: the next opens when the current one closes.
function showErrorsInSequence([first, ...rest]: [string, string][]) {
  if (!first) return;
  const [key, message] = first;
  let advanced = false;
  const next = () => {
    if (advanced) return;
    advanced = true;
    showErrorsInSequence(rest);
  };
  toast.error(message, { id: key, onDismiss: next, onAutoClose: next });
}

export function OnboardingWizard({
  role,
  defaultName,
}: {
  role: ProfileRole;
  defaultName: string;
}) {
  const router = useRouter();
  const steps = STEPS[role];
  const phoneStatus = usePhoneVerificationStatus();
  // Until the status loads, the gate is open; the server still checks the profile create.
  const required = phoneStatus.data?.required ?? false;
  // The verified number is kept here, because a number verified before the profile exists
  // is not on the profile yet.
  const [verified, setVerified] = useState<{
    phoneNumber: string;
    verifiedAt: string;
  } | null>(null);
  const pending = phoneStatus.data?.pendingVerification ?? null;
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProfileForm>(() => emptyForm(defaultName));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  // Set while the final save runs and kept on success until the router leaves the page.
  const [finishing, setFinishing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstRender = useRef(true);

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const phone = normalizeBdPhone(form.phoneNumber);
  // A code checked before a reload is still held by the server, so onboarding resumes with it.
  const verifiedAt = verifiedAtFor(phone, verified, pending);
  const isVerified = verifiedAt !== null;
  const phoneBlocked = required && !isVerified;
  const onVerifyStep = current.id === VERIFY_ID;
  // When verification is required, the user cannot leave the verify step (or finish) unverified.
  // While the switch is still loading, the verify step waits for it.
  const stepBlocked =
    onVerifyStep && (phoneBlocked || (phoneStatus.isPending && !isVerified));
  const finishBlocked = isLast && phoneBlocked;
  const nextBlocked = stepBlocked || finishBlocked;
  const verifyIndex = steps.findIndex((s) => s.id === VERIFY_ID);
  const contactIndex = steps.findIndex((s) => s.id === "contact");

  // Returning users who already have a profile skip straight to the dashboard.
  useEffect(() => {
    profileApi
      .me()
      .then((me) => {
        if (profileOf(me)) router.replace("/dashboard");
        else setChecking(false);
      })
      .catch(async (err) => {
        if (err instanceof ApiError && err.status === 401) {
          await clearSession();
          router.replace("/sign-in");
        } else setChecking(false);
      });
  }, [router]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const update = (patch: Partial<ProfileForm>) => {
    // Editing the number discards the verification of the old one.
    if ("phoneNumber" in patch) setVerified(null);
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof ProfileForm];
      return next;
    });
  };

  const focusFirstInvalid = () =>
    requestAnimationFrame(() =>
      formRef.current
        ?.querySelector<HTMLElement>(
          "[aria-invalid=true]:is(input,textarea), [aria-invalid=true] input",
        )
        ?.focus(),
    );

  const submit = async () => {
    setSaving(true);
    setFinishing(true);
    const keys = steps.flatMap((s) => s.fields.map((f) => f.key));
    try {
      await profileApi.save(role, toPayload(role, form, keys));
      if (role === "TUTOR") await saveTutorLists(form, keys);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Leaving for sign-in: the overlay stays up until that navigation happens.
        await clearSession();
        router.replace("/sign-in");
        return;
      }
      setFinishing(false);
      if (
        err instanceof ApiError &&
        err.code === "PHONE_VERIFICATION_REQUIRED"
      ) {
        // Verified more than 30 minutes ago, or never: back to the verify step.
        setVerified(null);
        void phoneStatus.refetch();
        setStep(verifyIndex);
        toast.error("Verify your phone number to finish signing up.");
        setSaving(false);
        return;
      }
      const field = conflictField(err);
      if (field) {
        setStep(steps.findIndex((s) => s.fields.some((f) => f.key === field)));
        setErrors({ [field]: (err as Error).message });
        focusFirstInvalid();
      }
      toast.error(
        err instanceof Error ? err.message : "Couldn't save your profile.",
      );
      setSaving(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Enter in a field must not start a second save while one is in flight.
    if (saving || finishing) return;
    const found = validate(current.fields, form);
    if (Object.keys(found).length) {
      showErrorsInSequence(
        Object.entries(found).filter((e): e is [string, string] => !!e[1]),
      );
      setErrors(found);
      focusFirstInvalid();
      return;
    }
    // Enter in the code field must not skip a required check.
    if (stepBlocked) return;
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    // Enter in a field can submit while the number is unverified; send the user to the check.
    if (finishBlocked) {
      setStep(verifyIndex);
      return;
    }
    void submit();
  };

  return (
    <MotionConfig reducedMotion="user">
      <BlockingOverlay open={finishing} label="Setting up your dashboard…" />
      <main
        className="relative isolate flex min-h-dvh flex-col bg-[var(--color-neutral-off-white)]"
        style={{ backgroundImage: WASH }}
      >
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6 sm:px-6">
          <Image
            src="/assets/ic-demo/Icon-blue.png"
            alt="Masters Hub"
            width={860}
            height={220}
            preload
            className="h-10 w-auto sm:h-12"
          />
          <button
            type="button"
            disabled={signingOut}
            aria-busy={signingOut || undefined}
            onClick={async () => {
              setSigningOut(true);
              await clearSession();
              router.replace("/sign-in");
            }}
            className={cn(secondaryButton, "min-h-10 px-4")}
          >
            <PendingLabel pending={signingOut}>Sign out</PendingLabel>
          </button>
        </header>

        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12">
          <p className="text-sm font-semibold text-[var(--color-primary-core)]">
            {role === "TUTOR" ? "Tutor profile" : "Student profile"}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
            Let&apos;s set up your profile
          </p>

          <ol
            className="mt-6 grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
            }}
          >
            {steps.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li
                  key={s.id}
                  aria-current={active ? "step" : undefined}
                  className="grid gap-2"
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--color-neutral-charcoal)_10%,transparent)]"
                  >
                    <span
                      className={cn(
                        "block h-full origin-left rounded-full bg-[var(--color-primary-core)] transition-[scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
                        done || active ? "scale-x-100" : "scale-x-0",
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs font-medium sm:text-sm",
                      active
                        ? "text-[var(--color-neutral-charcoal)]"
                        : "text-[var(--color-text-secondary)]",
                    )}
                  >
                    {done && (
                      <Check
                        aria-hidden="true"
                        className="size-3.5 shrink-0"
                        strokeWidth={2.5}
                      />
                    )}
                    <span className="min-w-0">{s.title}</span>
                    <span className="sr-only">
                      {done ? " (done)" : active ? " (current)" : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>

          <form
            ref={formRef}
            noValidate
            onSubmit={onSubmit}
            aria-busy={checking || saving}
            className={cn(card, "mt-6 p-5 sm:p-8")}
          >
            {checking ? (
              <div className="grid gap-4" aria-label="Loading">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-12 animate-pulse rounded-[12px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none"
                  />
                ))}
              </div>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Step {step + 1} of {steps.length}
                  </p>
                  <h1
                    ref={headingRef}
                    tabIndex={-1}
                    className="mt-1 text-xl font-semibold text-[var(--color-neutral-charcoal)] outline-none sm:text-2xl"
                  >
                    {current.title}
                  </h1>
                  <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
                    {current.description}
                  </p>
                  {current.id === VERIFY_ID ? (
                    <div className="mt-6 grid gap-4">
                      {phone ? (
                        <PhoneVerificationPanel
                          key={phone}
                          phoneNumber={phone}
                          verifiedAt={verifiedAt}
                          onVerified={(result) => setVerified(result)}
                          onChangeNumber={() => setStep(contactIndex)}
                        />
                      ) : (
                        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                          Enter a valid phone number on the contact step first.
                        </p>
                      )}
                      {phone && !isVerified && !required && (
                        <button
                          type="button"
                          onClick={() => setStep((s) => s + 1)}
                          className={cn(ghostButton, "justify-self-start")}
                        >
                          Verify later
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-6">
                      <ProfileFields
                        fields={current.fields}
                        form={form}
                        errors={errors}
                        onChange={update}
                        inlineErrors={false}
                      />
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            )}

            {nextBlocked && !phoneStatus.isPending && (
              <p
                id="finish-blocked-reason"
                className="mt-6 text-sm font-medium text-pretty text-[var(--color-semantic-warning-text)]"
              >
                {finishBlocked
                  ? "Verify your phone number to finish setup."
                  : "Verify your phone number to continue."}
              </p>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={saving}
                  className={secondaryButton}
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  Back
                </button>
              ) : (
                <span className="hidden sm:block" />
              )}
              <button
                type="submit"
                disabled={checking || saving || nextBlocked}
                aria-busy={saving || undefined}
                aria-describedby={
                  nextBlocked && !phoneStatus.isPending
                    ? "finish-blocked-reason"
                    : undefined
                }
                className={cn(primaryButton, "sm:min-w-40")}
              >
                <PendingLabel pending={saving}>
                  {isLast ? (
                    <>
                      Finish setup
                      <Check
                        aria-hidden="true"
                        className="size-4"
                        strokeWidth={2.5}
                      />
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </>
                  )}
                </PendingLabel>
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-pretty text-[var(--color-text-secondary)]">
            You can change any of this later from your profile.
          </p>
        </div>
      </main>
    </MotionConfig>
  );
}
