"use client";

import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { coveragePercent, minutesByProject } from "@/lib/tracking-stats";
import CategoryDot from "../CategoryDot";
import MetaLabel from "../MetaLabel";

/** Minutes per category, plus coverage — how much of the waking day so far is accounted for. */
export default function RollupsModule({ dayISO, todayISO, now }: { dayISO: string; todayISO: string; now: Date }) {
  const { categories, segments, tasks, projects, settings, recordedMinutesForCategory } = useTasks();
  if (!settings) return null;

  const rows = categories
    .map((c) => ({ category: c, minutes: recordedMinutesForCategory(c.id) }))
    .filter((r) => r.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  const coverage = coveragePercent(segments, dayISO, todayISO, settings, now);

  const projectRows = minutesByProject(segments, tasks, projects, now);
  const projectMax = Math.max(1, ...projectRows.map((r) => r.minutes));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <MetaLabel>Coverage</MetaLabel>
        <span className="font-mono text-sm tabular-nums">{coverage}%</span>
        <div className="h-1.5 max-w-40 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-secondary transition-all duration-500"
            style={{ width: `${coverage}%` }}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ category, minutes }) => (
            <li key={category.id} className="flex items-center gap-3">
              <CategoryDot color={category.color} />
              <span className="w-28 shrink-0 truncate text-sm">{category.name}</span>
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(minutes / max) * 100}%`, backgroundColor: `var(--color-${category.color})` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {fmt(minutes)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {projectRows.length > 0 && (
        <div className="space-y-2 border-t border-border/70 pt-4">
          <MetaLabel as="div">By project</MetaLabel>
          <ul className="space-y-2">
            {projectRows.map(({ project, minutes }) => (
              <li key={project?.id ?? "none"} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: project?.color ?? "var(--color-muted-foreground)" }}
                />
                <span className="w-28 shrink-0 truncate text-sm">{project?.name ?? "No project"}</span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(minutes / projectMax) * 100}%`, backgroundColor: project?.color ?? "var(--color-muted-foreground)" }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {fmt(minutes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
