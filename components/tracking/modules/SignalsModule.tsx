"use client";

import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { coveragePercent, longestStretchMinutes, minutesByKind, mostFragmentedHour } from "@/lib/tracking-stats";
import type { CategoryKind } from "@/lib/types";
import MetaLabel from "../MetaLabel";

const KIND_LABEL: Record<CategoryKind, string> = {
  work: "Work",
  rest: "Rest",
  upkeep: "Upkeep",
  unclassified: "Unclassified",
};

/** Optimisation signals, read from `kind` — never a category name, so a rename never breaks a summary. */
export default function SignalsModule({ dayISO, todayISO, now }: { dayISO: string; todayISO: string; now: Date }) {
  const { segments, categories, settings } = useTasks();
  if (!settings) return null;

  const coverage = coveragePercent(segments, dayISO, todayISO, settings, now);
  const longest = longestStretchMinutes(segments, now);
  const fragmentedHour = mostFragmentedHour(segments);
  const byKind = minutesByKind(segments, categories, now);
  const kinds = (Object.keys(byKind) as CategoryKind[]).filter((k) => byKind[k] > 0);

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Signal label="Coverage" value={`${coverage}%`} />
      <Signal label="Longest stretch" value={longest > 0 ? fmt(Math.round(longest)) : "—"} />
      <Signal
        label="Most fragmented"
        value={fragmentedHour === null ? "—" : `${String(fragmentedHour).padStart(2, "0")}:00`}
      />
      <div>
        <MetaLabel>By kind</MetaLabel>
        {kinds.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {kinds.map((kind) => (
              <li key={kind} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{KIND_LABEL[kind]}</span>
                <span className="font-mono text-xs tabular-nums">{fmt(byKind[kind])}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <MetaLabel>{label}</MetaLabel>
      <p className="mt-1 truncate font-mono text-lg tabular-nums">{value}</p>
    </div>
  );
}
