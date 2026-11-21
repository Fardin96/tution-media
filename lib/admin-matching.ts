import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { ApiError, type ApiIssue } from "./profile";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type MatchingRecord = Schemas["MatchingConfigRecord"];
export type MatchingConfigValue = Schemas["MatchingConfigValue"];
export type MatchingConfigInput = Schemas["MatchingConfigInput"];
export type MatchingRules = MatchingConfigInput["rules"];
export type RuleId = keyof MatchingRules;
export type RuleMode = MatchingRules[RuleId]["mode"];
export type EquivalentGroup =
  MatchingConfigInput["curriculumEquivalents"][number];
export type MatchingPreview = Schemas["MatchingPreview"];
export type MatchingPreviewPair = Schemas["MatchingPreviewPair"];
export type MatchingExplain = Schemas["MatchingExplain"];
export type ExplainSet = Schemas["ExplainSet"];
export type RuleResult = Schemas["RuleResult"];
export type UnmatchedRequirement =
  Schemas["MatchingUnmatched"]["requirements"][number];
export type Blocker = UnmatchedRequirement["blockers"][number];
export type AdminCity = Schemas["AdminCity"];
export type CityUpsertBody = Schemas["CityUpsertInput"];
export type CityBoundary = CityUpsertBody["boundary"];

export const matchingKeys = {
  all: ["admin", "matching"] as const,
  config: ["admin", "matching", "config"] as const,
  preview: ["admin", "matching", "preview"] as const,
  unmatched: (olderThanHours: number) =>
    ["admin", "matching", "unmatched", olderThanHours] as const,
  explain: (requirementId: string, tutorId: string) =>
    ["admin", "matching", "explain", requirementId, tutorId] as const,
  cities: ["admin", "matching", "cities"] as const,
  districts: ["admin", "matching", "districts"] as const,
};

/** Rule order on the page and in explain responses. */
export const RULE_ORDER: RuleId[] = [
  "curriculum",
  "level",
  "subject",
  "groupTarget",
  "location",
  "gender",
  "salary",
  "schedule",
  "capacity",
  "quality",
  "recency",
];

export const UNMATCHED_LIMIT = 50;

export const matchingApi = {
  getConfig: () => unwrap(client.GET("/api/v1/admin/matching/config")),
  saveConfig: (config: MatchingConfigInput) =>
    unwrap(client.PUT("/api/v1/admin/matching/config", { body: config })),
  preview: (config: MatchingConfigInput) =>
    unwrap(client.POST("/api/v1/admin/matching/preview", { body: { config } })),
  explain: (requirementId: string, tutorId: string) =>
    unwrap(
      client.GET("/api/v1/admin/matching/explain", {
        params: { query: { requirementId, tutorId } },
      }),
    ),
  unmatched: (olderThanHours: number) =>
    unwrap(
      client.GET("/api/v1/admin/matching/unmatched", {
        params: {
          query: { olderThanHours, limit: UNMATCHED_LIMIT },
        },
      }),
    ),
  cities: () => unwrap(client.GET("/api/v1/admin/cities")),
  upsertCity: (slug: string, body: CityUpsertBody) =>
    unwrap(
      client.PUT("/api/v1/admin/cities/{slug}", {
        params: { path: { slug } },
        body,
      }),
    ),
  updateCity: (slug: string, isActive: boolean) =>
    unwrap(
      client.PATCH("/api/v1/admin/cities/{slug}", {
        params: { path: { slug } },
        body: { isActive },
      }),
    ),
  /** Districts come from the areas list, which always carries all 64. One district keeps the areas part small. */
  districts: async () => {
    const data = await unwrap(
      client.GET("/api/v1/admin/areas", {
        params: { query: { districtCode: "dhaka", isActive: "true" } },
      }),
    );
    return data.districts;
  },
};

export function useMatchingConfig() {
  return useQuery({
    queryKey: matchingKeys.config,
    queryFn: matchingApi.getConfig,
    staleTime: 15_000,
  });
}

/** A save bumps the version. The saved record goes into the cache, then the matching queries refresh. */
export function useSaveMatchingConfig() {
  const queryClient = useQueryClient();
  return useMutation<MatchingRecord, ApiError, MatchingConfigInput>({
    mutationFn: matchingApi.saveConfig,
    onSuccess: (record) => {
      queryClient.setQueryData(matchingKeys.config, record);
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: matchingKeys.all }),
  });
}

/** Counts under the saved rules and under the draft. Nothing is saved. */
export function usePreviewMatching() {
  return useMutation<MatchingPreviewPair, ApiError, MatchingConfigInput>({
    mutationFn: matchingApi.preview,
  });
}

export function useUnmatchedRequirements(olderThanHours: number) {
  return useQuery({
    queryKey: matchingKeys.unmatched(olderThanHours),
    queryFn: () => matchingApi.unmatched(olderThanHours),
    staleTime: 15_000,
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(text: string): boolean {
  return UUID.test(text.trim());
}

/** Runs only when both IDs are uuids. A 4xx (unknown ID) is not retried. */
export function useExplainMatch(requirementId: string, tutorId: string) {
  return useQuery({
    queryKey: matchingKeys.explain(requirementId, tutorId),
    queryFn: () => matchingApi.explain(requirementId, tutorId),
    enabled: isUuid(requirementId) && isUuid(tutorId),
    retry: (count, err) =>
      !(err instanceof ApiError && err.status < 500) && count < 2,
  });
}

export function useCities() {
  return useQuery({
    queryKey: matchingKeys.cities,
    queryFn: matchingApi.cities,
    staleTime: 15_000,
  });
}

export function useMatchingDistricts() {
  return useQuery({
    queryKey: matchingKeys.districts,
    queryFn: matchingApi.districts,
    staleTime: 5 * 60_000,
  });
}

export function useUpsertCity() {
  const queryClient = useQueryClient();
  return useMutation<
    AdminCity,
    ApiError,
    { slug: string; body: CityUpsertBody }
  >({
    mutationFn: ({ slug, body }) => matchingApi.upsertCity(slug, body),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: matchingKeys.all }),
  });
}

export function useUpdateCity() {
  const queryClient = useQueryClient();
  return useMutation<AdminCity, ApiError, { slug: string; isActive: boolean }>({
    mutationFn: ({ slug, isActive }) => matchingApi.updateCity(slug, isActive),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: matchingKeys.all }),
  });
}

/* ───────── Rule copy ───────── */

export const RULE_COPY: Record<RuleId, { name: string; description: string }> =
  {
    curriculum: {
      name: "Curriculum",
      description: "The tutor teaches the student's curriculum.",
    },
    level: {
      name: "Class",
      description: "The student's class is inside the tutor's class range.",
    },
    subject: {
      name: "Subjects",
      description: "The tutor teaches at least one of the subjects.",
    },
    groupTarget: {
      name: "Group and admission target",
      description:
        "Science, Business or Humanities group, and admission targets, when the student has one.",
    },
    location: {
      name: "Teaching zone",
      description:
        "Required: the student lives inside one of the tutor's zones. Ranks higher: closer tutors rank higher.",
    },
    gender: {
      name: "Tutor gender",
      description: "The tutor's gender matches the student's preference.",
    },
    salary: {
      name: "Salary",
      description: "The offer is at least the tutor's minimum salary.",
    },
    schedule: {
      name: "Days and time",
      description: "The days and start time fit the tutor's availability.",
    },
    capacity: {
      name: "Seats and start date",
      description:
        "The tutor takes this many students and is free by the hire date.",
    },
    quality: {
      name: "Rating and verification",
      description: "Rated and verified tutors rank higher.",
    },
    recency: {
      name: "Newer tuitions first",
      description: "Recently posted tuitions rank higher for tutors.",
    },
  };

export const REACH_LABEL = "City limit";

export const CITY_LIMIT_NOTE =
  "City limit: home tuition always needs the tutor to live in the student's city, within the edge distance below, or to have a zone there. Online tuition needs a tutor who teaches online.";

export const MODE_LABEL: Record<RuleMode, string> = {
  REQUIRED: "Required",
  RANK: "Ranks higher",
  OFF: "Off",
};

/** The label for a rule in blockers and explain rows. `reach` is the city limit. */
export function ruleLabel(rule: Blocker): string {
  return rule === "reach" ? REACH_LABEL : RULE_COPY[rule].name;
}

/* ───────── Draft config ───────── */

/** The editable part of a saved config: everything but the server's version. */
export function inputFrom(value: MatchingConfigValue): MatchingConfigInput {
  return clone({
    rules: value.rules,
    cityEdgeKm: value.cityEdgeKm,
    outsideCityKm: value.outsideCityKm,
    distanceScoreKm: value.distanceScoreKm,
    admissionIgnoresCurriculum: value.admissionIgnoresCurriculum,
    curriculumEquivalents: value.curriculumEquivalents,
  });
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Returns a copy of the draft with one rule's fields replaced. */
export function withRule<K extends RuleId>(
  draft: MatchingConfigInput,
  id: K,
  patch: Partial<MatchingRules[K]>,
): MatchingConfigInput {
  const rules = {
    ...draft.rules,
    [id]: { ...draft.rules[id], ...patch },
  } as MatchingRules;
  return { ...draft, rules };
}

/** Field keys the page uses for server issues. Rule fields are `rules.<id>.<field>`. */
export function fieldKey(path: readonly (string | number)[]): string {
  return path.join(".");
}

/**
 * Server issues keyed by field, the first message per field wins. The path's `body`, `params`
 * or `query` prefix is dropped, so keys read like the draft (`rules.level.weight`).
 */
export function issueFields(
  issues: ApiIssue[] | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues ?? []) {
    const path = [...issue.path];
    if (path[0] === "body" || path[0] === "params" || path[0] === "query") {
      path.shift();
    }
    const key = fieldKey(path);
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

function sameGroup(a: EquivalentGroup, b: EquivalentGroup): boolean {
  return a.length === b.length && a.every((c) => b.includes(c));
}

/** The two equivalence groups an admin can switch on. Other stored groups are kept as they are. */
export const EQUIVALENT_TOGGLES: { label: string; group: EquivalentGroup }[] = [
  {
    label: "Bangla Medium and English Version",
    group: ["BANGLA_MEDIUM", "ENGLISH_VERSION"],
  },
  {
    label: "Cambridge and Edexcel",
    group: ["EM_CAMBRIDGE", "EM_EDEXCEL"],
  },
];

export function hasGroup(
  groups: EquivalentGroup[],
  group: EquivalentGroup,
): boolean {
  return groups.some((g) => sameGroup(g, group));
}

/** True when a curriculum in `group` already sits in another group, so the toggle can't add it. */
export function groupBlocked(
  groups: EquivalentGroup[],
  group: EquivalentGroup,
): boolean {
  return (
    !hasGroup(groups, group) &&
    groups.some((g) => g.some((c) => group.includes(c)))
  );
}

export function toggleGroup(
  groups: EquivalentGroup[],
  group: EquivalentGroup,
  on: boolean,
): EquivalentGroup[] {
  if (on) return hasGroup(groups, group) ? groups : [...groups, group];
  return groups.filter((g) => !sameGroup(g, group));
}

/** Stored groups that are not one of the toggles. Read-only on the page. */
export function otherGroups(groups: EquivalentGroup[]): EquivalentGroup[] {
  return groups.filter(
    (g) => !EQUIVALENT_TOGGLES.some((t) => sameGroup(t.group, g)),
  );
}

const SCALAR_FIELDS = [
  "cityEdgeKm",
  "outsideCityKm",
  "distanceScoreKm",
  "admissionIgnoresCurriculum",
] as const;

/**
 * Every field that differs from the saved config, one entry per changed value. A toggled
 * equivalence group counts once. The save bar shows the length as "N unsaved changes".
 */
export function changedFields(
  saved: MatchingConfigInput,
  draft: MatchingConfigInput,
): string[] {
  const changes: string[] = [];
  for (const id of RULE_ORDER) {
    const a = saved.rules[id] as Record<string, unknown>;
    const b = draft.rules[id] as Record<string, unknown>;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[key] !== b[key]) changes.push(`rules.${id}.${key}`);
    }
  }
  for (const key of SCALAR_FIELDS) {
    if (saved[key] !== draft[key]) changes.push(key);
  }
  for (const { group } of EQUIVALENT_TOGGLES) {
    if (
      hasGroup(saved.curriculumEquivalents, group) !==
      hasGroup(draft.curriculumEquivalents, group)
    ) {
      changes.push(`curriculumEquivalents.${group.join("+")}`);
    }
  }
  return changes;
}

/* ───────── Explain rows ───────── */

export type ExplainRow = {
  key: string;
  label: string;
  /** The rule's mode. Null for the city limit, which has none. */
  mode: RuleMode | null;
  state: "pass" | "fail" | "off";
  percent: number | null;
};

/** The city limit first, then each rule in order. Off rules have no share of the score. */
export function explainRows(parts: ExplainSet["parts"]): ExplainRow[] {
  const rows: ExplainRow[] = [
    {
      key: "reach",
      label: REACH_LABEL,
      mode: null,
      state: parts.reach ? "pass" : "fail",
      percent: null,
    },
  ];
  for (const id of RULE_ORDER) {
    const result: RuleResult | undefined = parts.rules[id];
    if (!result) continue;
    const off = result.mode === "OFF";
    rows.push({
      key: id,
      label: RULE_COPY[id].name,
      mode: result.mode,
      state: off ? "off" : result.pass ? "pass" : "fail",
      percent: off ? null : Math.round(result.part * 100),
    });
  }
  return rows;
}

/* ───────── Cities ───────── */

export const CITY_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;

export function validateCitySlug(text: string): string | undefined {
  const value = text.trim();
  if (!value) return "Enter a slug.";
  if (!CITY_SLUG_PATTERN.test(value)) {
    return "Use 2 to 40 lowercase letters, digits or -, starting with a letter.";
  }
  return undefined;
}

export function validateCityName(text: string): string | undefined {
  const value = text.trim();
  if (value.length < 2) return "Use at least 2 characters.";
  if (value.length > 60) return "Use 60 characters or fewer.";
  return undefined;
}

export type BoundaryResult =
  { ok: true; boundary: CityBoundary } | { ok: false; message: string };

const BOUNDARY_HINT =
  "Use a GeoJSON file with one Polygon or MultiPolygon, or a Feature or FeatureCollection holding one.";

/** Accepts a Feature, a FeatureCollection with one feature, or a bare geometry. Returns the geometry. */
export function readBoundary(text: string): BoundaryResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, message: BOUNDARY_HINT };
  }
  const geometry = geometryOf(json);
  if (!geometry) return { ok: false, message: BOUNDARY_HINT };
  return { ok: true, boundary: geometry };
}

function geometryOf(json: unknown): CityBoundary | null {
  if (!json || typeof json !== "object") return null;
  const node = json as Record<string, unknown>;
  if (node.type === "FeatureCollection") {
    const features = node.features;
    if (!Array.isArray(features) || features.length !== 1) return null;
    return geometryOf(features[0]);
  }
  if (node.type === "Feature") return geometryOf(node.geometry);
  if (
    (node.type === "Polygon" || node.type === "MultiPolygon") &&
    Array.isArray(node.coordinates)
  ) {
    return { type: node.type, coordinates: node.coordinates } as CityBoundary;
  }
  return null;
}

export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/* ───────── Display helpers ───────── */

/** "3 days ago", "5 hours ago" or "12 minutes ago", counted from `now`. */
export function postedAgo(createdAt: string, now: Date): string {
  const ms = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  const hours = ms / 3_600_000;
  if (hours < 1) {
    return rtf.format(-Math.max(1, Math.floor(ms / 60_000)), "minute");
  }
  if (hours < 24) return rtf.format(-Math.floor(hours), "hour");
  return rtf.format(-Math.floor(hours / 24), "day");
}

/** Whole km² with a thousands separator: "1,464 km²". */
export function areaText(km2: number): string {
  return `${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 0 }).format(km2)} km²`;
}
