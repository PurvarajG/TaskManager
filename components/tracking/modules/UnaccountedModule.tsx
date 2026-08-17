"use client";

import { useState } from "react";
import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { wakingWindow } from "@/lib/tracking-day";
import type { Gap, TrackingSettings } from "@/lib/types";
import CategoryDot from "../CategoryDot";
import GapFillForm from "../GapFillForm";
import MetaLabel from "../MetaLabel";
import { presetChips } from "../presets";

function clockLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** A gap right at the edge of the waking window reads as an overnight boundary, not a mid-day hole. */
function overnightLabel(gap: Gap, settings: TrackingSettings, dayISO: string): string | null {
  const { start: wakeStart, end: wakeEnd } = wakingWindow(dayISO, settings);
  if (new Date(gap.startedAt).getTime() === wakeStart.getTime()) return "Since waking";
  if (new Date(gap.endedAt).getTime() >= wakeEnd.getTime()) return "Into the night";
  return null;
}

/** The module this whole feature exists for: what's missing, and one tap to fix it. */
export default function UnaccountedModule({ dayISO }: { dayISO: string }) {
  const { gaps, categories, activities, settings, fillGap } = useTasks();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { pinned } = presetChips(activities, categories);

  if (gaps.length === 0) {
    return <p className="text-sm text-muted-foreground">All accounted for.</p>;
  }

  return (
    <ul className="space-y-2">
      {gaps.map((gap) => {
        const key = `${gap.startedAt}-${gap.endedAt}`;
        const label = settings ? overnightLabel(gap, settings, dayISO) : null;
        return (
          <li key={key} className="rounded-lg border border-dashed border-border">
            <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
              <MetaLabel>
                {clockLabel(gap.startedAt)} – {clockLabel(gap.endedAt)}
              </MetaLabel>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmt(gap.minutes)}</span>
              {label && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">{label}</span>}

              <div className="ml-auto flex flex-wrap items-center gap-1.5">
                {pinned.slice(0, 4).map(({ activity, category }) => (
                  <button
                    key={activity.id}
                    onClick={() =>
                      fillGap({ startedAt: gap.startedAt, endedAt: gap.endedAt, categoryId: category.id, activityId: activity.id })
                    }
                    className="flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-accent/30 sm:min-h-8"
                  >
                    <CategoryDot color={category.color} />
                    {activity.name}
                  </button>
                ))}
                <button
                  onClick={() => setExpanded(expanded === key ? null : key)}
                  className="min-h-11 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted sm:min-h-8"
                >
                  Something else…
                </button>
              </div>
            </div>

            {expanded === key && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-3 py-2.5">
                <GapFillForm gap={gap} onFilled={() => setExpanded(null)} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
