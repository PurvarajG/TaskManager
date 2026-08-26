"use client";

import { fmt } from "@/lib/format";
import { useTasks } from "@/lib/store-context";
import { coveragePercent, minutesByKind, minutesByProject } from "@/lib/tracking-stats";
import { projectColorVar } from "@/lib/types";
import CategoryDot from "../CategoryDot";
import MetaLabel from "../MetaLabel";

/**
 * "Today at a glance" — the prototype's three-up `.stat-row` (Accounted /
 * Focus / Unaccounted) — plus the existing minutes-per-category and
 * minutes-per-project rundowns below it.
 */
export default function RollupsModule({ dayISO, todayISO, now }: { dayISO: string; todayISO: string; now: Date }) {
  const { categories, segments, tasks, projects, gaps, settings, recordedMinutesForCategory } = useTasks();
  if (!settings) return null;

  const rows = categories
    .map((c) => ({ category: c, minutes: recordedMinutesForCategory(c.id) }))
    .filter((r) => r.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  const max = Math.max(1, ...rows.map((r) => r.minutes));
  const coverage = coveragePercent(segments, dayISO, todayISO, settings, now);

  const projectRows = minutesByProject(segments, tasks, projects, now);
  const projectMax = Math.max(1, ...projectRows.map((r) => r.minutes));

  const accountedMinutes = rows.reduce((sum, r) => sum + r.minutes, 0);
  const focusMinutes = minutesByKind(segments, categories, now).work;
  const unaccountedMinutes = gaps.reduce((sum, g) => sum + g.minutes, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2.5">
        <Stat value={fmt(accountedMinutes)} label="Accounted" />
        <Stat value={fmt(focusMinutes)} label="Focus" />
        <Stat value={fmt(unaccountedMinutes)} label="Unaccounted" />
      </div>

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
                  style={{ background: project?.color ? projectColorVar(project.color) : "var(--color-muted-foreground)" }}
                />
                <span className="w-28 shrink-0 truncate text-sm">{project?.name ?? "No project"}</span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(minutes / projectMax) * 100}%`, backgroundColor: project?.color ? projectColorVar(project.color) : "var(--color-muted-foreground)" }}
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

/** The prototype's `.stat` card — big serif value over a quiet uppercase label. */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-3 text-center">
      <p className="font-display text-lg leading-tight">{value}</p>
      <MetaLabel className="mt-1 block">{label}</MetaLabel>
    </div>
  );
}
