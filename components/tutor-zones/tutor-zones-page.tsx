"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  card,
  primaryButton,
  secondaryButton,
} from "@/components/profile/styles";
import { BackLink } from "@/components/ui/back-link";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PendingLabel } from "@/components/ui/pending-label";
import { ZoneLimitRequestDialog } from "@/components/tutor-zones/zone-limit-request-dialog";
import { ZoneMap, hasMapsKey } from "@/components/tutor-zones/zone-map";
import { ZoneEditor } from "@/components/tutor-zones/zone-editor";
import { ZoneList } from "@/components/tutor-zones/zone-list";
import { useMyPackages, type MyPackage } from "@/lib/packages";
import { invalidateTutorZones } from "@/lib/query-keys";
import { toastError, toastSuccess } from "@/lib/toast";
import {
  useTutorRequirements,
  type TutorRequirement,
} from "@/lib/tutor-requirements";
import {
  emptyZoneForm,
  fromZone,
  roundCoord,
  tutorZoneApi,
  useTutorZones,
  type TutorZone,
  type ZoneForm,
} from "@/lib/tutor-zones";

const WASH = [
  "radial-gradient(60% 50% at 10% 0%, color-mix(in oklab, var(--color-primary-core) 16%, transparent), transparent 70%)",
  "radial-gradient(50% 40% at 95% 10%, color-mix(in oklab, var(--color-mesh-glow) 45%, transparent), transparent 70%)",
  "radial-gradient(40% 40% at 80% 100%, var(--color-secondary-sky), transparent 70%)",
].join(",");

// Two columns only once the content has room for both: the map needs about 30rem.
const SPLIT = "@min-[52rem]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]";
const LIMIT_NOTE_ID = "zones-limit-note";

type EditorState =
  { mode: "create" } | { mode: "edit"; zone: TutorZone } | null;

function zoneWord(count: number) {
  return count === 1 ? "zone" : "zones";
}

/** A set loses applying ability when it is the default, active, in-person only, and this zone is its only one. */
function blocksApplying(set: TutorRequirement, zoneId: string) {
  return (
    set.isDefault &&
    set.isActive &&
    !set.teachesOnline &&
    set.zoneIds.length === 1 &&
    set.zoneIds[0] === zoneId
  );
}

function ZonesSkeleton() {
  return (
    <div role="status" className={cn("grid gap-6", SPLIT)}>
      <span className="sr-only">Loading your zones</span>
      <div
        aria-hidden="true"
        className="h-72 animate-pulse rounded-[24px] bg-[var(--color-surface-subtle)] motion-reduce:animate-none @min-[52rem]:h-auto @min-[52rem]:min-h-[28rem]"
      />
      <div
        aria-hidden="true"
        className={cn(
          card,
          "h-80 animate-pulse p-5 motion-reduce:animate-none",
        )}
      />
    </div>
  );
}

export function TutorZonesPage() {
  const queryClient = useQueryClient();
  const zonesQuery = useTutorZones();
  const requirementsQuery = useTutorRequirements("all");
  const packagesQuery = useMyPackages();

  const [editor, setEditor] = useState<EditorState>(null);
  const [form, setForm] = useState<ZoneForm>(emptyZoneForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TutorZone | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [dropping, setDropping] = useState(false);

  const data = zonesQuery.data;
  const editingId = editor?.mode === "edit" ? editor.zone.id : null;

  // The zone being edited is shown as the draft instead of its saved circle.
  const mapZones = useMemo(
    () => (data?.zones ?? []).filter((zone) => zone.id !== editingId),
    [data, editingId],
  );
  const draft =
    editor && form.lat !== null && form.lng !== null
      ? { lat: form.lat, lng: form.lng, radiusM: form.radiusM }
      : null;

  const deleteZone = useMutation({
    mutationFn: (id: string) => tutorZoneApi.remove(id),
    onSuccess: (_result, id) => {
      void invalidateTutorZones(queryClient);
      toastSuccess("Zone deleted");
      setPendingDelete(null);
      setSelectedId((current) => (current === id ? null : current));
      setEditor((current) =>
        current?.mode === "edit" && current.zone.id === id ? null : current,
      );
      setDropping(false);
    },
    onError: (err) => {
      toastError("Couldn't delete the zone.", err);
    },
  });

  const affectedSets = useMemo(() => {
    if (!pendingDelete || !requirementsQuery.data) return [];
    return requirementsQuery.data.filter((set) =>
      set.zoneIds.includes(pendingDelete.id),
    );
  }, [pendingDelete, requirementsQuery.data]);

  const blockedSets = pendingDelete
    ? affectedSets.filter((set) => blocksApplying(set, pendingDelete.id))
    : [];

  // Open packages that use the zone. zone.packageIds lists only open packages.
  const affectedPackages = useMemo(() => {
    if (!pendingDelete || !packagesQuery.data) return [];
    return packagesQuery.data.packages.filter((pkg) =>
      pendingDelete.packageIds.includes(pkg.id),
    );
  }, [pendingDelete, packagesQuery.data]);

  // A package left with no zone and not online stays open but drops out of nearby browse.
  const emptiedPackages: MyPackage[] = pendingDelete
    ? affectedPackages.filter(
        (pkg) =>
          !pkg.teachesOnline &&
          (data?.zones ?? []).every(
            (zone) =>
              zone.id === pendingDelete.id || !zone.packageIds.includes(pkg.id),
          ),
      )
    : [];

  // A new zone has no pin yet, so with a map key the first tap places it.
  function openCreate() {
    setForm(emptyZoneForm());
    setSelectedId(null);
    setEditor({ mode: "create" });
    setDropping(hasMapsKey());
  }

  function openEdit(zone: TutorZone) {
    setForm(fromZone(zone));
    setSelectedId(zone.id);
    setEditor({ mode: "edit", zone });
    setDropping(false);
  }

  function closeEditor() {
    setEditor(null);
    setDropping(false);
  }

  function toggleDropPin() {
    if (!editor) {
      openCreate();
      return;
    }
    setDropping((on) => !on);
  }

  // Escape leaves drop mode without closing the editor.
  useEffect(() => {
    if (!dropping) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDropping(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dropping]);

  function patchForm(patch: Partial<ZoneForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  // A map pick moves the pin away from any searched address, so the address goes too.
  // One tap places one pin, so drop mode ends; the pin stays draggable.
  function pickOnMap(lat: number, lng: number) {
    setDropping(false);
    patchForm({
      lat: roundCoord(lat),
      lng: roundCoord(lng),
      placeId: null,
      addressText: null,
    });
  }

  const used = data?.used ?? 0;
  const limit = data?.limit ?? 0;
  const atLimit = data !== undefined && used >= limit;
  const pending = data?.pendingRequest ?? null;

  return (
    <main
      className="relative isolate flex min-h-dvh flex-col bg-[var(--color-neutral-off-white)]"
      style={{ backgroundImage: WASH }}
    >
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 pt-6 sm:px-6">
        <Link href="/dashboard" aria-label="Masters Hub Home" data-home-link>
          <Image
            src="/assets/ic-demo/Icon-blue.png"
            alt="Masters Hub"
            width={860}
            height={220}
            preload
            className="h-10 w-auto sm:h-12"
          />
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-12">
        <div className="mb-4 flex">
          <BackLink href="/dashboard">Dashboard</BackLink>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance text-[var(--color-neutral-charcoal)] sm:text-3xl">
          Teaching zones
        </h1>
        <p className="mt-1 text-sm text-pretty text-[var(--color-text-secondary)] sm:text-base">
          Students inside a zone can find you for in-person tuition.
        </p>

        {data && (
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-sm font-medium text-[var(--color-neutral-charcoal)] tabular-nums">
              {`${used} of ${limit} ${zoneWord(limit)} used`}
            </p>
            <div
              role="meter"
              aria-label="Zones used"
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={used}
              aria-valuetext={`${used} of ${limit} ${zoneWord(limit)} used`}
              className="h-2 w-48 max-w-full overflow-hidden rounded-full bg-[var(--color-secondary-sky)]"
            >
              <div
                className="h-full rounded-full bg-[var(--color-primary-core)] transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{
                  width:
                    limit > 0
                      ? `${Math.min(100, (used / limit) * 100)}%`
                      : "0%",
                }}
              />
            </div>
          </div>
        )}

        <div className="@container mt-8">
          {zonesQuery.isPending ? (
            <ZonesSkeleton />
          ) : zonesQuery.isError ? (
            <div
              role="alert"
              className={cn(card, "flex flex-col items-start gap-3 p-6")}
            >
              <p className="font-semibold text-[var(--color-neutral-charcoal)]">
                Couldn&apos;t load your zones.
              </p>
              <button
                type="button"
                onClick={() => void zonesQuery.refetch()}
                disabled={zonesQuery.isFetching}
                aria-busy={zonesQuery.isFetching || undefined}
                className={cn(secondaryButton, "min-h-10 px-4")}
              >
                <PendingLabel pending={zonesQuery.isFetching}>
                  Try again
                </PendingLabel>
              </button>
            </div>
          ) : (
            <div className={cn("grid gap-6", SPLIT)}>
              <div className="flex flex-col gap-3">
                <div
                  className={cn(
                    "relative h-72 overflow-hidden rounded-[24px] shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_12px_32px_-12px_rgb(0_0_0/0.08)] outline-2 outline-offset-2 transition-[outline-color] duration-150 ease-out motion-reduce:transition-none @min-[52rem]:h-auto @min-[52rem]:min-h-[28rem] @min-[52rem]:flex-1",
                    dropping
                      ? "outline-[var(--color-primary-core)]"
                      : "outline-transparent",
                  )}
                >
                  <ZoneMap
                    zones={mapZones}
                    draft={draft}
                    selectedId={selectedId}
                    onPick={editor ? pickOnMap : undefined}
                    onSelect={(id) => setSelectedId(id)}
                    dropping={dropping}
                  />
                </div>

                {hasMapsKey() && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button
                      type="button"
                      onClick={toggleDropPin}
                      aria-pressed={dropping}
                      disabled={!editor && atLimit}
                      aria-describedby={
                        !editor && atLimit ? LIMIT_NOTE_ID : undefined
                      }
                      className={cn(
                        secondaryButton,
                        "min-h-10 px-4",
                        dropping &&
                          "bg-[var(--color-secondary-sky)] text-[var(--color-primary-core)] shadow-[0_0_0_1.5px_var(--color-primary-core)] hover:bg-[var(--color-secondary-sky)]",
                      )}
                    >
                      <MapPin aria-hidden="true" className="size-4" />
                      Drop pin
                    </button>
                    <p
                      role="status"
                      className="text-sm text-pretty text-[var(--color-text-secondary)]"
                    >
                      {dropping ? "Click or tap the map to place the pin." : ""}
                    </p>
                  </div>
                )}
              </div>

              <section
                aria-labelledby="zones-panel-title"
                className={cn(card, "self-start p-5")}
              >
                {editor ? (
                  <ZoneEditor
                    zone={editor.mode === "edit" ? editor.zone : null}
                    form={form}
                    onFormChange={patchForm}
                    onClose={closeEditor}
                  />
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2
                        id="zones-panel-title"
                        className="text-base font-semibold text-[var(--color-neutral-charcoal)]"
                      >
                        Your zones
                      </h2>
                      <button
                        type="button"
                        onClick={openCreate}
                        disabled={atLimit}
                        aria-describedby={atLimit ? LIMIT_NOTE_ID : undefined}
                        className={cn(primaryButton, "min-h-10 px-4")}
                      >
                        <Plus aria-hidden="true" className="size-4" />
                        Add zone
                      </button>
                    </div>

                    {atLimit && (
                      <div
                        id={LIMIT_NOTE_ID}
                        className="mt-4 flex flex-col items-start gap-3 rounded-[16px] bg-[var(--color-neutral-off-white)] p-4"
                      >
                        <p className="text-sm text-pretty text-[var(--color-text-secondary)]">
                          {`You've used all ${limit} ${zoneWord(limit)}. Delete one or ask for more.`}
                        </p>
                        {pending ? (
                          <p
                            role="status"
                            className="text-sm font-medium text-[var(--color-neutral-charcoal)]"
                          >
                            {`Request for ${pending.requestedLimit} ${zoneWord(pending.requestedLimit)} pending`}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setLimitOpen(true)}
                            className={cn(secondaryButton, "min-h-10 px-4")}
                          >
                            Ask for more zones
                          </button>
                        )}
                      </div>
                    )}

                    <ZoneList
                      zones={data?.zones ?? []}
                      selectedId={selectedId}
                      canAdd={!atLimit}
                      onSelect={(id) => setSelectedId(id)}
                      onEdit={openEdit}
                      onDelete={setPendingDelete}
                      onAdd={openCreate}
                    />
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={
          pendingDelete ? `Delete ${pendingDelete.label}?` : "Delete zone?"
        }
        actions={[
          {
            label: "Keep zone",
            variant: "secondary",
            onSelect: () => setPendingDelete(null),
          },
          {
            label: "Delete zone",
            variant: "primary",
            // The dialog stays open until the delete lands; a failure keeps it open with the toast.
            pending: deleteZone.isPending,
            onSelect: () => {
              if (pendingDelete && !deleteZone.isPending) {
                deleteZone.mutate(pendingDelete.id);
              }
            },
          },
        ]}
      >
        {requirementsQuery.isPending ? (
          <p>Checking which sets use this zone.</p>
        ) : requirementsQuery.isError ? (
          <p>We couldn&apos;t check which sets use this zone.</p>
        ) : affectedSets.length === 0 ? (
          <p>No requirement sets use this zone.</p>
        ) : (
          <>
            <p>
              {affectedSets.length === 1
                ? "1 requirement set uses this zone:"
                : `${affectedSets.length} requirement sets use this zone:`}
            </p>
            <ul className="list-disc ps-5 text-[var(--color-neutral-charcoal)]">
              {affectedSets.map((set) => (
                <li key={set.id}>{set.name}</li>
              ))}
            </ul>
          </>
        )}
        {pendingDelete &&
          pendingDelete.packageIds.length > 0 &&
          (packagesQuery.isPending ? (
            <p>Checking which packages use this zone.</p>
          ) : packagesQuery.isError ? (
            <p>We couldn&apos;t check which packages use this zone.</p>
          ) : (
            affectedPackages.length > 0 && (
              <>
                <p>
                  {affectedPackages.length === 1
                    ? "1 package uses this zone:"
                    : `${affectedPackages.length} packages use this zone:`}
                </p>
                <ul className="list-disc ps-5 text-[var(--color-neutral-charcoal)]">
                  {affectedPackages.map((pkg) => (
                    <li key={pkg.id}>{pkg.title}</li>
                  ))}
                </ul>
              </>
            )
          ))}
        {blockedSets.map((set) => (
          <p
            key={set.id}
            role="status"
            className="rounded-[12px] border border-[var(--color-semantic-warning)] bg-[var(--color-semantic-warning-surface)] px-4 py-3 text-[var(--color-semantic-warning-text)]"
          >
            {`${set.name} is your default set. You can't apply to tuitions until it gets another zone or teaches online.`}
          </p>
        ))}
        {emptiedPackages.map((pkg) => (
          <p
            key={pkg.id}
            role="status"
            className="rounded-[12px] border border-[var(--color-semantic-warning)] bg-[var(--color-semantic-warning-surface)] px-4 py-3 text-[var(--color-semantic-warning-text)]"
          >
            {`${pkg.title} will have no zone left. It stays open but won't show to students searching near them.`}
          </p>
        ))}
      </ConfirmDialog>

      {data && (
        <ZoneLimitRequestDialog
          open={limitOpen}
          onOpenChange={setLimitOpen}
          currentLimit={data.limit}
          pendingRequest={data.pendingRequest}
        />
      )}
    </main>
  );
}
