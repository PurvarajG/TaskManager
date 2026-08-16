"use client";

import { useTasks } from "@/lib/store-context";
import { useElapsed } from "./TaskTime";

/**
 * A running timer follows you around the app, because the one thing you
 * always need from it is the ability to stop it from wherever you ended up.
 */
export default function TimerStrip() {
  const { running, tasks, stopTimer, openTask } = useTasks();
  const elapsed = useElapsed(running?.startedAt);

  if (!running) return null;

  const task = tasks.find((t) => t.id === running.taskId);

  return (
    <div className="fixed bottom-4 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-lg">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-accent motion-safe:animate-pulse-dot" />

      <button
        onClick={() => task && openTask(task.id)}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-accent"
      >
        {task?.title ?? "Timing"}
      </button>

      <span className="shrink-0 font-mono text-sm tabular-nums" aria-live="off">
        {elapsed}
      </span>
      {/* The clock updates every second, so it is announced once on stop
          rather than sixty times a minute. */}
      <span className="sr-only" aria-live="polite">
        Timing {task?.title ?? "a task"}
      </span>

      <button
        onClick={() => stopTimer()}
        className="shrink-0 rounded-lg bg-muted px-3 py-1.5 text-sm font-medium transition-colors hover:bg-border"
      >
        Stop
      </button>
    </div>
  );
}
