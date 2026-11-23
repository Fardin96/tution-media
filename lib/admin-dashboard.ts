import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { client, unwrap, type Schemas } from "./api-client";
import { queryKeys } from "./query-keys";
import { toastError, toastSuccess } from "./toast";

// Shapes come from tuition-api's OpenAPI document (lib/api-types.ts).
export type DashboardLayout = Schemas["AdminDashboardLayout"];
export type DashboardWidget = Schemas["AdminDashboardWidget"];
export type CatalogItem = DashboardLayout["catalog"][number];
export type WidgetId = CatalogItem["id"];
export type WidgetPayload = DashboardWidget["data"];
export type KpiPayload = Extract<WidgetPayload, { kind: "kpi" }>;
export type SeriesPayload = Extract<WidgetPayload, { kind: "series" }>;
export type FunnelPayload = Extract<WidgetPayload, { kind: "funnel" }>;
export type QueuePayload = Extract<WidgetPayload, { kind: "queue" }>;
export type DonutPayload = Extract<WidgetPayload, { kind: "donut" }>;
export type MetricFormat = KpiPayload["format"];
export type ColorToken = SeriesPayload["series"][number]["color"];
export type DashboardRange = DashboardWidget["range"];

export const RANGES: { value: DashboardRange; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "12m", label: "12 months" },
];
export const DEFAULT_RANGE: DashboardRange = "30d";
// Mirrors MAX_DASHBOARD_WIDGETS in tuition-api dashboard.schema.ts.
export const MAX_WIDGETS = 24;

export function parseRange(value: string | null): DashboardRange {
  return RANGES.some((r) => r.value === value)
    ? (value as DashboardRange)
    : DEFAULT_RANGE;
}

export const GROUP_LABEL: Record<CatalogItem["group"], string> = {
  pipeline: "Pipeline",
  people: "People",
  money: "Money",
  operations: "Operations",
  trust: "Trust",
};

/** CSS colour for a payload colour token (tokens live in app/globals.css). */
export const COLOR_VAR: Record<ColorToken, string> = {
  "chart-1": "var(--chart-1)",
  "chart-2": "var(--chart-2)",
  "chart-3": "var(--chart-3)",
  "chart-4": "var(--chart-4)",
  good: "var(--status-good)",
  warn: "var(--status-warn)",
  bad: "var(--status-bad)",
};

/**
 * Loading placeholders in the default layout's order: two full-width rows, four quarters, then
 * two halves. `body` matches the real renderer's height, so the grid does not jump on load.
 */
export const DASHBOARD_SKELETON: { span: string; body: string }[] = [
  { span: "col-span-12", body: "h-[300px]" },
  { span: "col-span-12", body: "h-[276px]" },
  ...[0, 1, 2, 3].map(() => ({
    span: "col-span-12 md:col-span-6 xl:col-span-3",
    body: "h-[124px]",
  })),
  ...[0, 1].map(() => ({
    span: "col-span-12 lg:col-span-6",
    body: "h-[276px]",
  })),
];

export const adminDashboardApi = {
  layout: () => unwrap(client.GET("/api/v1/admin/dashboard/layout")),
  save: (widgets: WidgetId[]) =>
    unwrap(client.PUT("/api/v1/admin/dashboard/layout", { body: { widgets } })),
  reset: () => unwrap(client.DELETE("/api/v1/admin/dashboard/layout")),
  widget: (id: WidgetId, range: DashboardRange) =>
    unwrap(
      client.GET("/api/v1/admin/dashboard/widgets/{id}", {
        params: { path: { id }, query: { range } },
      }),
    ),
};

export const dashboardLayoutQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.admin.dashboard.layout,
    queryFn: adminDashboardApi.layout,
    staleTime: 60_000,
  });

export const dashboardWidgetQueryOptions = (
  id: WidgetId,
  range: DashboardRange,
) =>
  queryOptions({
    queryKey: queryKeys.admin.dashboard.widget(id, range),
    queryFn: () => adminDashboardApi.widget(id, range),
    // The server caches for 60 s too, so refetching sooner gains nothing.
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

export function useDashboardLayout() {
  return useQuery(dashboardLayoutQueryOptions());
}

/** Keeps the previous range's data on screen while a new range loads. */
export function useDashboardWidget(id: WidgetId, range: DashboardRange) {
  return useQuery({
    ...dashboardWidgetQueryOptions(id, range),
    placeholderData: keepPreviousData,
  });
}

/** Save or reset: the response is written into the cache, then the layout is refetched. */
function useLayoutMutation<V>(
  mutationFn: (vars: V) => Promise<DashboardLayout>,
  success: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (layout) => {
      qc.setQueryData(queryKeys.admin.dashboard.layout, layout);
      toastSuccess(success);
    },
    onError: (err) => toastError("Couldn't save your dashboard.", err),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.admin.dashboard.layout }),
  });
}

export function useSaveDashboardLayout() {
  return useLayoutMutation(adminDashboardApi.save, "Dashboard saved");
}

export function useResetDashboardLayout() {
  return useLayoutMutation(
    () => adminDashboardApi.reset(),
    "Dashboard reset to the default",
  );
}

/** Adds one widget at the end of the saved layout (used by the finder's "Add and jump"). */
export function useAddDashboardWidget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: WidgetId) => {
      const layout = qc.getQueryData<DashboardLayout>(
        queryKeys.admin.dashboard.layout,
      );
      const widgets = layout?.widgets ?? [];
      return adminDashboardApi.save([...widgets.filter((w) => w !== id), id]);
    },
    onSuccess: (layout) =>
      qc.setQueryData(queryKeys.admin.dashboard.layout, layout),
    onError: (err) => toastError("Couldn't add that widget.", err),
    onSettled: () =>
      qc.invalidateQueries({ queryKey: queryKeys.admin.dashboard.layout }),
  });
}

/** Rows that differ between two ordered lists: added + removed + moved. */
export function countLayoutChanges(saved: WidgetId[], draft: WidgetId[]) {
  const added = draft.filter((id) => !saved.includes(id)).length;
  const removed = saved.filter((id) => !draft.includes(id)).length;
  const kept = draft.filter((id) => saved.includes(id));
  const keptSaved = saved.filter((id) => draft.includes(id));
  const moved = kept.filter((id, i) => keptSaved[i] !== id).length;
  return added + removed + moved;
}

/** Moves one id up (-1) or down (+1); out-of-range moves return the list unchanged. */
export function moveWidget(list: WidgetId[], id: WidgetId, by: -1 | 1) {
  const from = list.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
