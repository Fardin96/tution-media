import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { applicationApi } from "./applications";
import { profileApi, type ApiError } from "./profile";
import { invalidatePackages, queryKeys } from "./query-keys";
import { combinedLevelLabel, type EducationLookup } from "./education";
import { formatTaka, type Tone } from "./requirements";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type TutorPackage = Schemas["Package"];
export type MyPackage = Schemas["MyPackage"];
export type CreatePackageInput = Schemas["CreatePackageInput"];
export type UpdatePackageInput = Schemas["UpdatePackageInput"];

export const packageApi = {
  mine: () => unwrap(client.GET("/api/v1/packages/mine")),
  get: (id: string) =>
    unwrap(client.GET("/api/v1/packages/{id}", { params: { path: { id } } })),
  create: (body: CreatePackageInput) =>
    unwrap(client.POST("/api/v1/packages", { body })),
  update: (id: string, body: UpdatePackageInput) =>
    unwrap(
      client.PATCH("/api/v1/packages/{id}", {
        params: { path: { id } },
        body,
      }),
    ),
  close: (id: string) =>
    unwrap(
      client.POST("/api/v1/packages/{id}/close", { params: { path: { id } } }),
    ),
};

export type PackageCoverage = TutorPackage["coverage"];

export const COVERAGE_LABEL: Record<PackageCoverage, string> = {
  FULL_CURRICULUM: "Full curriculum",
  PARTIAL: "Part of the curriculum",
};

/** "12 weeks", "1 week". */
export function durationLabel(weeks: number): string {
  return weeks === 1 ? "1 week" : `${weeks} weeks`;
}

/** The whole-package price, e.g. "৳15,000". */
export function priceLabel(price: number): string {
  return formatTaka(price);
}

/** "Class 6 to Class 10" across the package's curricula; the bare numbers while the lookup loads. */
export function packageLevelText(
  lookup: EducationLookup | undefined,
  pkg: Pick<TutorPackage, "levelMin" | "levelMax" | "curricula">,
): string {
  const label = (level: number) =>
    combinedLevelLabel(lookup, pkg.curricula, level) || `Level ${level}`;
  return pkg.levelMin === pkg.levelMax
    ? label(pkg.levelMin)
    : `${label(pkg.levelMin)} to ${label(pkg.levelMax)}`;
}

/** "Online", "2 zones", "Online · 1 zone"; "No zone" when neither (hidden from nearby browse). */
export function packagePlaceText(
  pkg: Pick<TutorPackage, "teachesOnline" | "zoneCount">,
): string {
  const zones =
    pkg.zoneCount === 0
      ? null
      : pkg.zoneCount === 1
        ? "1 zone"
        : `${pkg.zoneCount} zones`;
  if (pkg.teachesOnline && zones) return `Online · ${zones}`;
  if (pkg.teachesOnline) return "Online";
  return zones ?? "No zone";
}

/** The pill on a tutor's package card. A confirmed request counts as taken even while the package is OPEN. */
export function packageState(pkg: Pick<MyPackage, "status" | "closed">): {
  label: string;
  tone: Tone;
} {
  if (pkg.closed) return { label: "Taken", tone: "success" };
  if (pkg.status === "OPEN") return { label: "Live", tone: "info" };
  return { label: "Closed", tone: "neutral" };
}

/** Apply readiness from the shared account query. Packages don't need a default requirement set. */
export function usePackageReadiness() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => profileApi.me(),
  });
}

/** The readiness gaps that block publishing a package. */
export function packageMissing(missing: string[]): string[] {
  return missing.filter((key) => key !== "default_requirement");
}

export function useMyPackages() {
  return useQuery({
    queryKey: queryKeys.packages.mine,
    queryFn: () => packageApi.mine(),
    staleTime: 15_000,
  });
}

/** The tutor's own package, any state. Shares the browse detail key, so writes refresh both. */
export function useMyPackage(id: string) {
  return useQuery({
    queryKey: queryKeys.browse.package(id),
    queryFn: () => packageApi.get(id),
    staleTime: 15_000,
  });
}

export function usePackageRequests(packageId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.applications.forPackage(packageId),
    queryFn: ({ pageParam }) => applicationApi.forPackage(packageId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
}

export function useCreatePackage() {
  const queryClient = useQueryClient();
  return useMutation<TutorPackage, ApiError, CreatePackageInput>({
    mutationFn: (body) => packageApi.create(body),
    onSettled: () => invalidatePackages(queryClient),
  });
}

export function useUpdatePackage(id: string) {
  const queryClient = useQueryClient();
  return useMutation<TutorPackage, ApiError, UpdatePackageInput>({
    mutationFn: (body) => packageApi.update(id, body),
    onSettled: () => invalidatePackages(queryClient),
  });
}

export function useClosePackage() {
  const queryClient = useQueryClient();
  return useMutation<TutorPackage, ApiError, string>({
    mutationFn: (id) => packageApi.close(id),
    onSettled: () => invalidatePackages(queryClient),
  });
}
