"use client";

import dynamic from "next/dynamic";
import type {
  CatalogItem,
  DashboardRange,
  WidgetPayload,
} from "@/lib/admin-dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { FunnelWidget } from "./funnel-widget";
import { QueueWidget } from "./queue-widget";

// Every recharts widget loads through this one boundary (see charts.tsx).
const ChartWidget = dynamic(() => import("./charts"), {
  ssr: false,
  loading: () => (
    <div aria-hidden="true">
      <Skeleton className="h-[240px] w-full" />
    </div>
  ),
});

/** Picks the renderer for a widget's payload kind. */
export function WidgetBody({
  item,
  payload,
  range,
}: {
  item: CatalogItem;
  payload: WidgetPayload;
  range: DashboardRange;
}) {
  switch (payload.kind) {
    case "funnel":
      return <FunnelWidget payload={payload} />;
    case "queue":
      return <QueueWidget payload={payload} />;
    default:
      return <ChartWidget payload={payload} title={item.title} range={range} />;
  }
}
