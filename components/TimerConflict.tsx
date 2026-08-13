"use client";

import { useTasks } from "@/lib/store-context";

/**
 * A second timer isn't an error to apologise for — it's a choice. This names
 * the task already running and offers the single action that resolves it.
 */
export default function TimerConflict() {
  const { timerConflict, dismissTimerConflict, switchTimer, tasks } = useTasks();
  if (!timerConflict) return null;

  const runningTask = tasks.find((t) => t.id === timerConflict.runningTaskId);
  const target = tasks.find((t) => t.id === timerConflict.taskId);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="A timer is already running"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/30" onClick={dismissTimerConflict} aria-hidden />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
        <p className="text-sm">
          You&rsquo;re already timing{" "}
          <span className="font-semibold">{runningTask?.title ?? "another task"}</span>.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button
            autoFocus
            onClick={() => switchTimer(timerConflict.taskId)}
            className="min-h-11 rounded-lg bg-gradient-to-r from-accent to-accent-secondary px-3 py-2 text-sm font-medium text-accent-foreground hover:brightness-110 sm:min-h-9"
          >
            Stop it and start {target ? `"${target.title}"` : "this one"}
          </button>
          <button
            onClick={dismissTimerConflict}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Keep going
          </button>
        </div>
      </div>
    </div>
  );
}
