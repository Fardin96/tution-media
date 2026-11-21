"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminPage, FilterChips } from "@/components/admin/admin-ui";
import { CitiesTab } from "@/components/admin/matching-cities";
import { ExplainTab } from "@/components/admin/matching-explain";
import { RulesTab } from "@/components/admin/matching-rules";
import {
  UNMATCHED_HOURS,
  UnmatchedTab,
} from "@/components/admin/matching-unmatched";
import { useAdminMe } from "@/lib/admin";

type Tab = "rules" | "unmatched" | "explain" | "cities";

const TABS: { value: Tab; label: string }[] = [
  { value: "rules", label: "Rules" },
  { value: "unmatched", label: "Unmatched" },
  { value: "explain", label: "Explain" },
  { value: "cities", label: "Cities" },
];

const TAB_VALUES = new Set<string>(TABS.map((t) => t.value));
const HOUR_VALUES = new Set<string>(UNMATCHED_HOURS.map(String));
const DEFAULT_HOURS = 24;

export function MatchingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const me = useAdminMe();

  const rawTab = searchParams.get("tab") ?? "rules";
  const tab: Tab = TAB_VALUES.has(rawTab) ? (rawTab as Tab) : "rules";
  const rawHours = searchParams.get("hours") ?? String(DEFAULT_HOURS);
  const hours = HOUR_VALUES.has(rawHours) ? Number(rawHours) : DEFAULT_HOURS;

  // Tab and window live in the URL. The defaults drop their param so the bare path stays clean.
  function setParam(name: string, value: string, defaultValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === defaultValue) params.delete(name);
    else params.set(name, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <AdminPage
      back={{ href: "/dashboard/admin", label: "Admin" }}
      title="Matching"
      description="Which tutors match which tuitions. Rule changes apply within about 30 seconds."
    >
      <FilterChips
        label="Matching section"
        value={tab}
        options={TABS}
        onChange={(next) => setParam("tab", next, "rules")}
      />

      {tab === "rules" && (
        <RulesTab
          canEdit={me.isSuperAdmin}
          readOnlyNote={me.isSuccess && !me.isSuperAdmin}
        />
      )}
      {tab === "unmatched" && (
        <UnmatchedTab
          hours={hours}
          onHoursChange={(next) =>
            setParam("hours", String(next), String(DEFAULT_HOURS))
          }
        />
      )}
      {tab === "explain" && <ExplainTab />}
      {tab === "cities" && <CitiesTab canEdit={me.isSuperAdmin} />}
    </AdminPage>
  );
}
