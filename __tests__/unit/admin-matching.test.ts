import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import {
  EQUIVALENT_TOGGLES,
  RULE_COPY,
  RULE_ORDER,
  areaText,
  changedFields,
  explainRows,
  groupBlocked,
  hasGroup,
  inputFrom,
  isUuid,
  issueFields,
  matchingApi,
  otherGroups,
  postedAgo,
  readBoundary,
  readFileText,
  ruleLabel,
  toggleGroup,
  useExplainMatch,
  validateCityName,
  validateCitySlug,
  withRule,
  type EquivalentGroup,
  type MatchingConfigValue,
} from "@/lib/admin-matching";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** The default rules, as the API returns them under `config`. */
function savedValue(
  overrides: Partial<MatchingConfigValue> = {},
): MatchingConfigValue {
  return {
    version: 4,
    rules: {
      curriculum: { mode: "REQUIRED", weight: 3 },
      level: { mode: "REQUIRED", weight: 3, slack: 0 },
      subject: { mode: "REQUIRED", weight: 3, requireAll: false },
      groupTarget: { mode: "REQUIRED", weight: 1 },
      location: { mode: "RANK", weight: 3 },
      gender: { mode: "REQUIRED", weight: 1 },
      salary: { mode: "RANK", weight: 2 },
      schedule: { mode: "RANK", weight: 2 },
      capacity: { mode: "RANK", weight: 1 },
      quality: { mode: "RANK", weight: 2 },
      recency: { mode: "RANK", weight: 1 },
    },
    cityEdgeKm: 2,
    outsideCityKm: 2,
    distanceScoreKm: 10,
    admissionIgnoresCurriculum: true,
    curriculumEquivalents: [],
    ...overrides,
  };
}

function sent(i: number) {
  const [url, init] = vi.mocked(apiFetch).mock.calls[i];
  const parsed = new URL(String(url));
  return {
    method: init?.method,
    path: parsed.pathname,
    search: parsed.searchParams,
    body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
  };
}

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
});

describe("matchingApi paths", () => {
  it("reads and saves the config, sending only the editable fields", async () => {
    const record = {
      config: savedValue(),
      defaults: savedValue({ version: 0 }),
      ruleModes: {},
      updatedAt: null,
      updatedByName: null,
    };
    vi.mocked(apiFetch).mockResolvedValue(json(200, record));

    await matchingApi.getConfig();
    expect(sent(0)).toMatchObject({
      method: "GET",
      path: "/api/v1/admin/matching/config",
    });

    const input = inputFrom(savedValue());
    vi.mocked(apiFetch).mockImplementation(async () => json(200, record));
    await matchingApi.saveConfig(input);
    expect(sent(1)).toMatchObject({
      method: "PUT",
      path: "/api/v1/admin/matching/config",
      body: input,
    });
  });

  it("posts a draft for preview under config", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => json(200, {}));
    const input = inputFrom(savedValue());
    await matchingApi.preview(input);
    expect(sent(0)).toMatchObject({
      method: "POST",
      path: "/api/v1/admin/matching/preview",
      body: { config: input },
    });
  });

  it("sends both IDs to explain and the window and limit to unmatched", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => json(200, {}));
    const requirementId = "11111111-1111-4111-8111-111111111111";
    const tutorId = "22222222-2222-4222-8222-222222222222";
    await matchingApi.explain(requirementId, tutorId);
    expect(sent(0).path).toBe("/api/v1/admin/matching/explain");
    expect(sent(0).search.get("requirementId")).toBe(requirementId);
    expect(sent(0).search.get("tutorId")).toBe(tutorId);

    await matchingApi.unmatched(72);
    expect(sent(1).path).toBe("/api/v1/admin/matching/unmatched");
    expect(sent(1).search.get("olderThanHours")).toBe("72");
    expect(sent(1).search.get("limit")).toBe("50");
  });

  it("puts a city by slug and patches its active flag", async () => {
    vi.mocked(apiFetch).mockImplementation(async () => json(200, {}));
    const boundary = {
      type: "Polygon" as const,
      coordinates: [
        [
          [90.3, 23.7],
          [90.4, 23.7],
          [90.4, 23.8],
          [90.3, 23.7],
        ],
      ],
    };
    await matchingApi.upsertCity("testville", {
      name: "Testville",
      districtCode: "dhaka",
      boundary,
    });
    expect(sent(0)).toMatchObject({
      method: "PUT",
      path: "/api/v1/admin/cities/testville",
      body: { name: "Testville", districtCode: "dhaka", boundary },
    });

    await matchingApi.updateCity("testville", false);
    expect(sent(1)).toMatchObject({
      method: "PATCH",
      path: "/api/v1/admin/cities/testville",
      body: { isActive: false },
    });
  });

  it("reads the districts from one narrowed areas request", async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      json(200, {
        areas: [],
        districts: [{ code: "dhaka", name: "Dhaka", division: "Dhaka" }],
      }),
    );
    const districts = await matchingApi.districts();
    expect(districts).toEqual([
      { code: "dhaka", name: "Dhaka", division: "Dhaka" },
    ]);
    expect(sent(0).path).toBe("/api/v1/admin/areas");
    expect(sent(0).search.get("districtCode")).toBe("dhaka");
  });
});

describe("useExplainMatch", () => {
  it("stays idle until both IDs are uuids", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client }, children);
    }
    const { result } = renderHook(
      () =>
        useExplainMatch("not-a-uuid", "22222222-2222-4222-8222-222222222222"),
      { wrapper: Wrapper },
    );
    expect(result.current.fetchStatus).toBe("idle");
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("fetches once both IDs are uuids", async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(200, { sets: [] }));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(QueryClientProvider, { client }, children);
    }
    const { result } = renderHook(
      () =>
        useExplainMatch(
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
        ),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});

describe("draft config", () => {
  it("drops the server version when it builds the input", () => {
    const input = inputFrom(savedValue());
    expect(input).not.toHaveProperty("version");
    expect(Object.keys(input)).toEqual([
      "rules",
      "cityEdgeKm",
      "outsideCityKm",
      "distanceScoreKm",
      "admissionIgnoresCurriculum",
      "curriculumEquivalents",
    ]);
  });

  it("counts one change for a mode switch", () => {
    const saved = inputFrom(savedValue());
    const draft = withRule(saved, "subject", { mode: "RANK" });
    expect(changedFields(saved, draft)).toEqual(["rules.subject.mode"]);
  });

  it("counts each changed value separately and leaves the saved copy alone", () => {
    const saved = inputFrom(savedValue());
    let draft = withRule(saved, "level", { slack: 1 });
    draft = withRule(draft, "gender", { weight: 4 });
    draft = { ...draft, cityEdgeKm: 0.5 };
    expect(changedFields(saved, draft)).toEqual([
      "rules.level.slack",
      "rules.gender.weight",
      "cityEdgeKm",
    ]);
    expect(saved.rules.level.slack).toBe(0);
  });

  it("counts a toggled equivalence group once", () => {
    const saved = inputFrom(savedValue());
    const draft = {
      ...saved,
      curriculumEquivalents: toggleGroup(
        saved.curriculumEquivalents,
        ["EM_CAMBRIDGE", "EM_EDEXCEL"],
        true,
      ),
    };
    expect(changedFields(saved, draft)).toEqual([
      "curriculumEquivalents.EM_CAMBRIDGE+EM_EDEXCEL",
    ]);
  });

  it("reports no change for an identical draft", () => {
    const saved = inputFrom(savedValue());
    expect(changedFields(saved, inputFrom(savedValue()))).toEqual([]);
  });
});

describe("equivalence groups", () => {
  const bangla = ["BANGLA_MEDIUM", "ENGLISH_VERSION"] as const;

  it("adds a group once and removes it on switch off", () => {
    const on = toggleGroup([], [...bangla], true);
    expect(on).toEqual([[...bangla]]);
    expect(toggleGroup(on, [...bangla], true)).toEqual(on);
    expect(toggleGroup(on, [...bangla], false)).toEqual([]);
  });

  it("matches a group regardless of order", () => {
    const stored: EquivalentGroup[] = [["ENGLISH_VERSION", "BANGLA_MEDIUM"]];
    expect(hasGroup(stored, [...bangla])).toBe(true);
  });

  it("blocks a toggle when one of its curricula sits in another group", () => {
    const stored: EquivalentGroup[] = [["BANGLA_MEDIUM", "EM_IB"]];
    expect(groupBlocked(stored, [...bangla])).toBe(true);
    expect(groupBlocked([], [...bangla])).toBe(false);
  });

  it("keeps stored groups that are not toggles, read-only", () => {
    const stored: EquivalentGroup[] = [[...bangla], ["EM_IB", "EM_AMERICAN"]];
    expect(otherGroups(stored)).toEqual([["EM_IB", "EM_AMERICAN"]]);
    expect(EQUIVALENT_TOGGLES.map((t) => t.label)).toEqual([
      "Bangla Medium and English Version",
      "Cambridge and Edexcel",
    ]);
  });
});

describe("issueFields", () => {
  it("keys server issues by the draft's field names", () => {
    const fields = issueFields([
      { path: ["body", "rules", "level", "weight"], message: "Too big" },
      { path: ["body", "rules", "level", "weight"], message: "Second" },
      { path: ["body", "cityEdgeKm"], message: "Not a half km" },
      { path: ["params", "slug"], message: "Bad slug" },
      { path: ["body", "curriculumEquivalents", 0], message: "Duplicate" },
    ]);
    expect(fields).toEqual({
      "rules.level.weight": "Too big",
      cityEdgeKm: "Not a half km",
      slug: "Bad slug",
      "curriculumEquivalents.0": "Duplicate",
    });
  });

  it("is empty without issues", () => {
    expect(issueFields(undefined)).toEqual({});
  });
});

describe("rule copy", () => {
  it("lists every rule once, in the order the spec gives", () => {
    expect(RULE_ORDER).toEqual([
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
    ]);
    expect(RULE_ORDER.map((id) => RULE_COPY[id].name)).toEqual([
      "Curriculum",
      "Class",
      "Subjects",
      "Group and admission target",
      "Teaching zone",
      "Tutor gender",
      "Salary",
      "Days and time",
      "Seats and start date",
      "Rating and verification",
      "Newer tuitions first",
    ]);
  });

  it("names the city limit as reach", () => {
    expect(ruleLabel("reach")).toBe("City limit");
    expect(ruleLabel("gender")).toBe("Tutor gender");
  });
});

describe("explainRows", () => {
  const rule = (
    mode: "REQUIRED" | "RANK" | "OFF",
    pass: boolean,
    part: number,
  ) => ({
    mode,
    pass,
    part,
  });

  it("starts with the city limit and turns each part into a percentage", () => {
    const rows = explainRows({
      version: 4,
      score: 72,
      passes: true,
      reach: true,
      rules: {
        curriculum: rule("REQUIRED", true, 1),
        level: rule("REQUIRED", true, 0.6667),
        subject: rule("RANK", false, 0),
        salary: rule("OFF", false, 0.5),
      },
    });
    expect(rows[0]).toEqual({
      key: "reach",
      label: "City limit",
      mode: null,
      state: "pass",
      percent: null,
    });
    expect(rows.map((r) => r.key)).toEqual([
      "reach",
      "curriculum",
      "level",
      "subject",
      "salary",
    ]);
    expect(rows[1]).toMatchObject({ mode: "REQUIRED", state: "pass" });
    expect(rows[3]).toMatchObject({ mode: "RANK", state: "fail" });
    expect(rows[2]).toMatchObject({ state: "pass", percent: 67 });
    expect(rows[3]).toMatchObject({ state: "fail", percent: 0 });
    expect(rows[4]).toMatchObject({ state: "off", percent: null });
  });

  it("marks a failed city limit", () => {
    const rows = explainRows({
      version: 4,
      score: 0,
      passes: false,
      reach: false,
      rules: {},
    });
    expect(rows).toEqual([
      {
        key: "reach",
        label: "City limit",
        mode: null,
        state: "fail",
        percent: null,
      },
    ]);
  });
});

describe("cities", () => {
  it("accepts a lowercase slug and refuses the rest", () => {
    expect(validateCitySlug("sylhet")).toBeUndefined();
    expect(validateCitySlug("new-city-2")).toBeUndefined();
    expect(validateCitySlug("")).toBe("Enter a slug.");
    expect(validateCitySlug("Sylhet")).toBeDefined();
    expect(validateCitySlug("2city")).toBeDefined();
    expect(validateCitySlug("a")).toBeDefined();
  });

  it("checks the name length", () => {
    expect(validateCityName("Dh")).toBeUndefined();
    expect(validateCityName("D")).toBe("Use at least 2 characters.");
    expect(validateCityName("x".repeat(61))).toBe(
      "Use 60 characters or fewer.",
    );
  });

  it("formats the area as whole km²", () => {
    expect(areaText(1463.7)).toBe("1,464 km²");
  });
});

describe("readBoundary", () => {
  const ring = [
    [
      [90.3, 23.7],
      [90.4, 23.7],
      [90.4, 23.8],
      [90.3, 23.7],
    ],
  ];

  it("reads a bare Polygon, a Feature and a one-feature collection", () => {
    const polygon = { type: "Polygon", coordinates: ring };
    expect(readBoundary(JSON.stringify(polygon))).toEqual({
      ok: true,
      boundary: polygon,
    });
    expect(
      readBoundary(JSON.stringify({ type: "Feature", geometry: polygon })),
    ).toEqual({ ok: true, boundary: polygon });
    expect(
      readBoundary(
        JSON.stringify({
          type: "FeatureCollection",
          features: [{ type: "Feature", geometry: polygon }],
        }),
      ),
    ).toEqual({ ok: true, boundary: polygon });
  });

  it("refuses several features, other geometries and bad JSON", () => {
    const polygon = { type: "Polygon", coordinates: ring };
    const two = {
      type: "FeatureCollection",
      features: [
        { type: "Feature", geometry: polygon },
        { type: "Feature", geometry: polygon },
      ],
    };
    expect(readBoundary(JSON.stringify(two)).ok).toBe(false);
    expect(
      readBoundary(JSON.stringify({ type: "LineString", coordinates: [] })).ok,
    ).toBe(false);
    expect(readBoundary("{not json").ok).toBe(false);
  });

  it("reads a File through FileReader", async () => {
    const file = new File(
      [JSON.stringify({ type: "Polygon", coordinates: ring })],
      "dhaka.geojson",
      { type: "application/geo+json" },
    );
    const text = await readFileText(file);
    expect(readBoundary(text).ok).toBe(true);
  });
});

describe("postedAgo", () => {
  const now = new Date("2026-11-20T12:00:00Z");

  it("counts in days, hours and minutes", () => {
    expect(postedAgo("2026-11-17T12:00:00Z", now)).toBe("3 days ago");
    expect(postedAgo("2026-11-19T12:00:00Z", now)).toBe("1 day ago");
    expect(postedAgo("2026-11-20T07:00:00Z", now)).toBe("5 hours ago");
    expect(postedAgo("2026-11-20T11:30:00Z", now)).toBe("30 minutes ago");
  });
});

describe("isUuid", () => {
  it("accepts a uuid and refuses the rest", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid(" 11111111-1111-4111-8111-111111111111 ")).toBe(true);
    expect(isUuid("11111111")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});
