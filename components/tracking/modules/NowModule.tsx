"use client";

import { useState } from "react";
import { useElapsed } from "@/components/TaskTime";
import { useTasks } from "@/lib/store-context";
import CategoryDot from "../CategoryDot";
import MetaLabel from "../MetaLabel";
import { presetChips } from "../presets";
import QuickAddActivity from "../QuickAddActivity";
import { segmentLabel } from "../segment-label";
import TaskPicker from "../TaskPicker";

/**
 * The live control: what's running right now, and one tap to switch it.
 * Starting a preset while one runs hands off atomically — never stop, then
 * separately start — so the timeline is never briefly tracking nothing.
 */
export default function NowModule() {
  const { categories, activities, runningSegment, tasks, projects, startSegment, switchSegment, stopSegment } =
    useTasks();
  const [showAll, setShowAll] = useState(false);

  const elapsed = useElapsed(runningSegment?.startedAt);
  const runningCategory = categories.find((c) => c.id === runningSegment?.categoryId);
  const runningLabel = runningSegment ? segmentLabel(runningSegment, categories, activities, tasks) : "";

  const { pinned, rest } = presetChips(activities, categories);
  // The running activity's chip must always be visible even if unpinned.
  const runningChip =
    runningSegment?.activityId && !pinned.some((c) => c.activity.id === runningSegment.activityId)
      ? rest.find((c) => c.activity.id === runningSegment.activityId)
      : undefined;
  const visiblePinned = runningChip ? [...pinned, runningChip] : pinned;
  const hiddenRest = runningChip ? rest.filter((c) => c.activity.id !== runningChip.activity.id) : rest;

  function start(categoryId: string, activityId: string) {
    if (runningSegment?.activityId === activityId) return;
    if (runningSegment) {
      switchSegment({ categoryId, activityId });
    } else {
      startSegment({ categoryId, activityId });
    }
  }

  function startTask(taskId: string) {
    if (runningSegment?.taskId === taskId) return;
    if (runningSegment) {
      switchSegment({ taskId });
    } else {
      startSegment({ taskId });
    }
  }

  return (
    <div className="space-y-4">
      {runningSegment ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-accent/30 bg-accent/[0.035] px-4 py-3">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-accent motion-safe:animate-pulse-dot" />
          {runningCategory && <CategoryDot color={runningCategory.color} />}
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{runningLabel}</span>
          <span className="font-mono text-sm tabular-nums" aria-live="off">
            {elapsed}
          </span>
          <button
            onClick={() => stopSegment()}
            className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium transition-colors hover:bg-border"
          >
            Stop
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing is being tracked. Pick something below.</p>
      )}

      <div>
        <MetaLabel className="mb-2 block">Start a task</MetaLabel>
        <TaskPicker
          tasks={tasks}
          projects={projects}
          value={runningSegment?.taskId}
          onChange={startTask}
          placeholder="Time a task…"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <MetaLabel>Quick start</MetaLabel>
          <a href="/tracking/settings" className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent hover:underline">
            Manage →
          </a>
        </div>

        {visiblePinned.length > 0 || hiddenRest.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {visiblePinned.map(({ activity, category }) => {
              const active = runningSegment?.activityId === activity.id;
              return (
                <button
                  key={activity.id}
                  onClick={() => start(category.id, activity.id)}
                  disabled={active}
                  className={`flex min-h-11 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors sm:min-h-9 ${
                    active
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-border bg-card hover:border-accent/30"
                  }`}
                >
                  <CategoryDot color={category.color} />
                  {activity.name}
                </button>
              );
            })}

            <QuickAddActivity />

            {hiddenRest.length > 0 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="min-h-11 rounded-full px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted sm:min-h-9"
              >
                {showAll ? "⌃ Show fewer" : `⌄ Show all (${hiddenRest.length} more)`}
              </button>
            )}

            {showAll &&
              hiddenRest.map(({ activity, category }) => {
                const active = runningSegment?.activityId === activity.id;
                return (
                  <button
                    key={activity.id}
                    onClick={() => start(category.id, activity.id)}
                    disabled={active}
                    className={`flex min-h-11 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors sm:min-h-9 ${
                      active
                        ? "border-accent/40 bg-accent/10 text-accent"
                        : "border-border bg-card hover:border-accent/30"
                    }`}
                  >
                    <CategoryDot color={category.color} />
                    {activity.name}
                  </button>
                );
              })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No quick-start presets yet.{" "}
            <a href="/tracking/settings" className="text-accent hover:underline">
              Add some in settings
            </a>
            .
          </p>
        )}
      </div>
    </div>
  );
}
