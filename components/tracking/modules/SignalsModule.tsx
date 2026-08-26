"use client";

import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { coveragePercent, longestStretchMinutes, minutesByKind, mostFragmentedHour } from "@/lib/tracking-stats";
import type { CategoryKind } from "@/lib/types";
import PanelRow from "@/components/ui/PanelRow";

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
    <div>
      <PanelRow detail={`${coverage}% of waking hours accounted for`}>
        <span className="font-medium">Coverage</span>
      </PanelRow>
      <PanelRow
        detail={longest > 0 ? `${fmt(Math.round(longest))} · longest continuous stretch today` : "Nothing recorded yet"}
      >
        <span className="font-medium">Longest stretch</span>
      </PanelRow>
      <PanelRow
        detail={
          fragmentedHour === null
            ? "Not enough switching to call out"
            : `${String(fragmentedHour).padStart(2, "0")}:00 · most segment starts in one hour`
        }
      >
        <span className="font-medium">Most fragmented</span>
      </PanelRow>
      <PanelRow
        detail={
          kinds.length === 0 ? (
            "—"
          ) : (
            <ul>
              {kinds.map((kind) => (
                <li key={kind} className="flex items-baseline justify-between gap-2">
                  <span>{KIND_LABEL[kind]}</span>
                  <span className="font-mono tabular-nums">{fmt(byKind[kind])}</span>
                </li>
              ))}
            </ul>
          )
        }
      >
        <span className="font-medium">By kind</span>
      </PanelRow>
    </div>
  );
}
