import {
  useInfiniteQuery,
  useQuery,
  queryOptions,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import type { paths } from "./api-types";
import { queryKeys } from "./query-keys";

// Filter values come from the generated query types, so they match what the API accepts.
type RequirementQuery = NonNullable<
  paths["/api/v1/requirements"]["get"]["parameters"]["query"]
>;
type TutorQuery = NonNullable<
  paths["/api/v1/tutors"]["get"]["parameters"]["query"]
>;

export type BrowseRequirement = Schemas["BrowseRequirement"];
export type BrowseRequirementPage = Schemas["BrowseRequirementPage"];
export type TuitionPackage = Schemas["Package"];
export type PackagePage = Schemas["PackagePage"];
export type BrowseCurriculum = NonNullable<RequirementQuery["curriculum"]>;
export type TutorGender = NonNullable<TutorQuery["gender"]>;
export type BrowseScope = "nearby" | "all";
/** Requirements add set mode (matching engine) and invited (requirements a student invited the tutor to). */
export type RequirementBrowseScope = BrowseScope | "set" | "invited";
/** Set mode only. Undefined means best match, the API default for sets. */
export type RequirementSort = "match" | "newest";
export type TutorGap = BrowseRequirementPage["gaps"][number];

export interface RequirementBrowseFilters {
  scope: RequirementBrowseScope;
  /** Only sent in set mode. */
  setId?: string;
  /** Only sent in set mode. */
  sort?: RequirementSort;
  curriculum?: BrowseCurriculum;
  levelCode?: number;
  subjectId?: number;
  areaId?: number;
}

export interface PackageBrowseFilters {
  scope: BrowseScope;
  curriculum?: BrowseCurriculum;
  levelCode?: number;
  subjectId?: number;
}

export interface TutorSearchFilters {
  area?: number;
  subject?: number;
  gender?: TutorGender;
  name?: string;
}

export const BROWSE_CURRICULA = [
  "BANGLA_MEDIUM",
  "ENGLISH_VERSION",
  "EM_CAMBRIDGE",
  "EM_EDEXCEL",
  "EM_IB",
  "EM_AMERICAN",
  "MADRASAH",
] as const satisfies readonly BrowseCurriculum[];

export const TUTOR_GENDERS = [
  "MALE",
  "FEMALE",
  "OTHER",
] as const satisfies readonly TutorGender[];

// Compile-time guard: fails when the generated enum gains a code this list does not have.
type MissingCurriculum = Exclude<
  BrowseCurriculum,
  (typeof BROWSE_CURRICULA)[number]
>;
const _curriculaComplete: [MissingCurriculum] extends [never]
  ? true
  : MissingCurriculum = true;
void _curriculaComplete;

export const DEFAULT_BROWSE_SCOPE: BrowseScope = "nearby";

export const browseApi = {
  requirements: (
    filters: RequirementBrowseFilters,
    cursor?: string,
  ): Promise<BrowseRequirementPage> => {
    // Set and invited modes send only their own keys; the manual filters are ignored by the API.
    const query: RequirementQuery =
      filters.scope === "set"
        ? {
            scope: "set",
            setId: filters.setId,
            sort: filters.sort ?? "match",
            cursor,
          }
        : filters.scope === "invited"
          ? { scope: "invited", cursor }
          : {
              scope: filters.scope,
              curriculum: filters.curriculum,
              levelCode: filters.levelCode,
              subjectId: filters.subjectId,
              areaId: filters.areaId,
              cursor,
            };
    return unwrap(client.GET("/api/v1/requirements", { params: { query } }));
  },
  packages: (
    filters: PackageBrowseFilters,
    cursor?: string,
  ): Promise<PackagePage> =>
    unwrap(
      client.GET("/api/v1/packages", {
        params: { query: { ...filters, cursor } },
      }),
    ),
  package: (id: string): Promise<TuitionPackage> =>
    unwrap(client.GET("/api/v1/packages/{id}", { params: { path: { id } } })),
  tutors: (filters: TutorSearchFilters) =>
    unwrap(client.GET("/api/v1/tutors", { params: { query: filters } })),
  nearbyTutors: (radiusMeters: number) =>
    unwrap(
      client.GET("/api/v1/tutors/nearby", {
        params: { query: { radiusMeters } },
      }),
    ),
};

export function useBrowseRequirements(filters: RequirementBrowseFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.browse.requirements(filters),
    queryFn: ({ pageParam }) => browseApi.requirements(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
    // Set mode waits until a set is chosen; the API rejects scope=set without setId.
    enabled: filters.scope !== "set" || Boolean(filters.setId),
  });
}

export function useBrowsePackages(filters: PackageBrowseFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.browse.packages(filters),
    queryFn: ({ pageParam }) => browseApi.packages(filters, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}

export const packageQueryOptions = (id: string) =>
  queryOptions({
    queryKey: queryKeys.browse.package(id),
    queryFn: () => browseApi.package(id),
    staleTime: 30_000,
  });

export function usePackage(id: string) {
  return useQuery(packageQueryOptions(id));
}

export function useTutorSearch(filters: TutorSearchFilters) {
  return useQuery({
    queryKey: queryKeys.browse.tutors(filters),
    queryFn: () => browseApi.tutors(filters),
    staleTime: 30_000,
  });
}

export function useNearbyTutors(radiusMeters: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.browse.nearbyTutors(radiusMeters),
    queryFn: () => browseApi.nearbyTutors(radiusMeters),
    staleTime: 30_000,
    enabled,
  });
}

/**
 * Keeps the first row for each id. A match cursor restarts at offset 0 after a config change,
 * so a page appended later can repeat rows the list already shows.
 */
export function dedupeBy<T>(rows: T[], key: (row: T) => string): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const id = key(row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function dedupeById<T extends { id: string }>(rows: T[]): T[] {
  return dedupeBy(rows, (row) => row.id);
}

/** "" for no distance, "Under 1 km" below one kilometre, otherwise "2.5 km" (whole numbers drop the decimal). */
export function formatDistanceKm(km: number | null): string {
  if (km === null || km === undefined) return "";
  if (km < 1) return "Under 1 km";
  return `${Number(km.toFixed(1))} km`;
}

/* ───────── URL state ───────── */

export interface ParamReader {
  get(name: string): string | null;
}

function readInt(raw: string | null, min?: number): number | undefined {
  if (raw === null || raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n)) return undefined;
  if (min !== undefined && n < min) return undefined;
  return n;
}

function readScope(raw: string | null): BrowseScope {
  return raw === "all" ? "all" : DEFAULT_BROWSE_SCOPE;
}

function readRequirementScope(raw: string | null): RequirementBrowseScope {
  return raw === "set" || raw === "all" || raw === "invited"
    ? raw
    : DEFAULT_BROWSE_SCOPE;
}

function readSetId(raw: string | null): string | undefined {
  const id = raw?.trim();
  return id ? id : undefined;
}

/** Only "newest" is written to the URL; no sort key means best match. */
function readSort(raw: string | null): RequirementSort | undefined {
  return raw === "newest" ? "newest" : undefined;
}

function readCurriculum(raw: string | null): BrowseCurriculum | undefined {
  return (BROWSE_CURRICULA as readonly string[]).includes(raw ?? "")
    ? (raw as BrowseCurriculum)
    : undefined;
}

function readGender(raw: string | null): TutorGender | undefined {
  return (TUTOR_GENDERS as readonly string[]).includes(raw ?? "")
    ? (raw as TutorGender)
    : undefined;
}

function toParams(
  entries: Record<string, string | number | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  return params;
}

export function requirementFiltersFromSearchParams(
  params: ParamReader,
): RequirementBrowseFilters {
  const scope = readRequirementScope(params.get("scope"));
  // Set mode reads only the set and sort; invited mode reads only the scope. Manual filters do not apply to either.
  if (scope === "set") {
    const sort = readSort(params.get("sort"));
    return {
      scope,
      setId: readSetId(params.get("set")),
      ...(sort ? { sort } : {}),
    };
  }
  if (scope === "invited") return { scope };
  return {
    scope,
    curriculum: readCurriculum(params.get("curriculum")),
    levelCode: readInt(params.get("levelCode")),
    subjectId: readInt(params.get("subjectId"), 1),
    areaId: readInt(params.get("areaId"), 1),
  };
}

export function requirementFiltersToSearchParams(
  filters: RequirementBrowseFilters,
): URLSearchParams {
  if (filters.scope === "set") {
    return toParams({
      scope: "set",
      set: filters.setId,
      sort: filters.sort === "newest" ? "newest" : undefined,
    });
  }
  if (filters.scope === "invited") return toParams({ scope: "invited" });
  return toParams({
    scope: filters.scope,
    curriculum: filters.curriculum,
    levelCode: filters.levelCode,
    subjectId: filters.subjectId,
    areaId: filters.areaId,
  });
}

export function packageFiltersFromSearchParams(
  params: ParamReader,
): PackageBrowseFilters {
  return {
    scope: readScope(params.get("scope")),
    curriculum: readCurriculum(params.get("curriculum")),
    levelCode: readInt(params.get("levelCode")),
    subjectId: readInt(params.get("subjectId"), 1),
  };
}

export function packageFiltersToSearchParams(
  filters: PackageBrowseFilters,
): URLSearchParams {
  return toParams({
    scope: filters.scope,
    curriculum: filters.curriculum,
    levelCode: filters.levelCode,
    subjectId: filters.subjectId,
  });
}

export function tutorFiltersFromSearchParams(
  params: ParamReader,
): TutorSearchFilters {
  const name = params.get("name")?.trim();
  return {
    area: readInt(params.get("area"), 1),
    subject: readInt(params.get("subject"), 1),
    gender: readGender(params.get("gender")),
    name: name ? name : undefined,
  };
}

export function tutorFiltersToSearchParams(
  filters: TutorSearchFilters,
): URLSearchParams {
  return toParams({
    area: filters.area,
    subject: filters.subject,
    gender: filters.gender,
    name: filters.name?.trim() || undefined,
  });
}
