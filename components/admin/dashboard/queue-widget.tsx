import Link from "next/link";
import { focusRing } from "@/components/profile/styles";
import { cn } from "@/lib/utils";
import type { QueuePayload } from "@/lib/admin-dashboard";
import { formatMetric } from "./format";

type Row = QueuePayload["rows"][number];

const listFormat = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

const STATUS: Record<Row["status"], { text: string; className: string }> = {
  late: {
    text: "Late",
    className:
      "bg-[var(--color-semantic-error-surface)] text-[var(--color-semantic-error-text)]",
  },
  watch: {
    text: "Watch",
    className:
      "bg-[var(--color-semantic-warning-surface)] text-[var(--color-semantic-warning-text)]",
  },
  ok: {
    text: "OK",
    className:
      "bg-[var(--color-neutral-off-white)] text-[var(--color-text-secondary)]",
  },
};

/** Oldest item's age: "3 h" under a day, "2 d" after. */
export function humanAge(hours: number | null) {
  if (hours === null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return "under 1 h";
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.floor(hours / 24)} d`;
}

/** Queues that have work, one link per row. Empty queues collapse into one "All clear" line. */
export function QueueWidget({ payload }: { payload: QueuePayload }) {
  const busy = payload.rows.filter((row) => row.count > 0);
  const clear = payload.rows.filter((row) => row.count === 0);

  if (busy.length === 0 && clear.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)]">
        Nothing in the queues.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {busy.length > 0 && (
        <ul className="flex flex-col divide-y divide-[var(--color-neutral-border)]">
          {busy.map((row) => {
            const status = STATUS[row.status];
            return (
              <li key={row.key}>
                <Link
                  href={row.href}
                  className={cn(
                    "flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-[12px] px-2 py-2.5 hover:bg-[var(--color-neutral-off-white)]",
                    focusRing,
                  )}
                >
                  <span className="min-w-0 text-sm font-medium text-[var(--color-neutral-charcoal)]">
                    {row.label}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
                    <span className="font-semibold text-[var(--color-neutral-charcoal)]">
                      {formatMetric(row.count, "count")}
                    </span>
                    <span className="text-[var(--color-text-secondary)]">
                      oldest {humanAge(row.oldestHours)}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
                        status.className,
                      )}
                    >
                      {status.text}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {clear.length > 0 && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          All clear: {listFormat.format(clear.map((row) => row.label))}
        </p>
      )}
    </div>
  );
}
