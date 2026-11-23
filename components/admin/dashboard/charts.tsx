"use client";

// The only route to recharts: widget-body.tsx loads this module with next/dynamic, so recharts and
// the widgets that import it are one chunk for the dashboard route.
import type {
  DashboardRange,
  DonutPayload,
  KpiPayload,
  SeriesPayload,
} from "@/lib/admin-dashboard";
import { DonutWidget } from "./donut-widget";
import { KpiWidget } from "./kpi-widget";
import { SeriesWidget } from "./series-widget";

export type ChartPayload = KpiPayload | SeriesPayload | DonutPayload;

export default function ChartWidget({
  payload,
  title,
  range,
}: {
  payload: ChartPayload;
  title: string;
  range: DashboardRange;
}) {
  switch (payload.kind) {
    case "kpi":
      return <KpiWidget payload={payload} />;
    case "series":
      return <SeriesWidget payload={payload} title={title} range={range} />;
    case "donut":
      return <DonutWidget payload={payload} title={title} />;
  }
}
