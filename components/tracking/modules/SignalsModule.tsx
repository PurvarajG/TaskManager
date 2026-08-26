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
      <PanelRow detail={longest > 0 ? "Longest continuous stretch today" : "Nothing recorded yet"}>
        <span className="font-medium">{longest > 0 ? fmt(Math.round(longest)) : "—"}</span>
      </PanelRow>
      <PanelRow
        detail={fragmentedHour === null ? "Not enough switching to call out" : "Most segment starts in one hour"}
      >
        <span className="font-medium">
          {fragmentedHour === null ? "Most fragmented" : `${String(fragmentedHour).padStart(2, "0")}:00`}
        </span>
      </PanelRow>
      <PanelRow
        detail={
          kinds.length === 0
            ? undefined
            : kinds.map((kind) => `${KIND_LABEL[kind]} ${fmt(byKind[kind])}`).join(" · ")
        }
      >
        <span className="font-medium">By kind</span>
        {kinds.length === 0 && <p className="mt-1 text-xs text-muted-foreground">—</p>}
      </PanelRow>
    </div>
  );
}
