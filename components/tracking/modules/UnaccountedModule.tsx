"use client";

import { useState } from "react";
import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { wakingWindow } from "@/lib/tracking-day";
import type { Gap, TrackingSettings } from "@/lib/types";
import PanelRow from "@/components/ui/PanelRow";
import ActivityPill from "../ActivityPill";
import GapFillForm from "../GapFillForm";
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
    <div>
      {gaps.map((gap) => {
        const key = `${gap.startedAt}-${gap.endedAt}`;
        const label = settings ? overnightLabel(gap, settings, dayISO) : null;
        return (
          <PanelRow
            key={key}
            detail={
              <>
                {fmt(gap.minutes)} · {label ?? "choose what you were doing"}
              </>
            }
          >
            <span className="font-medium">
              {clockLabel(gap.startedAt)} – {clockLabel(gap.endedAt)}
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {pinned.slice(0, 4).map(({ activity, category }) => (
                <ActivityPill
                  key={activity.id}
                  color={category.color}
                  name={activity.name}
                  onClick={() =>
                    fillGap({ startedAt: gap.startedAt, endedAt: gap.endedAt, categoryId: category.id, activityId: activity.id })
                  }
                />
              ))}
              <button
                onClick={() => setExpanded(expanded === key ? null : key)}
                className="min-h-11 rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted sm:min-h-8"
              >
                Something else…
              </button>
            </div>

            {expanded === key && (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/70 pt-3">
                <GapFillForm gap={gap} onFilled={() => setExpanded(null)} />
              </div>
            )}
          </PanelRow>
        );
      })}
    </div>
  );
}
