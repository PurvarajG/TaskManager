"use client";

import { useTasks } from "@/lib/store-context";

/**
 * Starting a timer is a one-click action from wherever a task appears, not
 * something you have to open the panel for. Starting a second one raises the
 * conflict prompt rather than silently doing nothing.
 */
export default function TimerButton({ taskId, title }: { taskId: string; title: string }) {
  const { running, startTimer, stopTimer } = useTasks();
  const isRunning = running?.taskId === taskId;

  return (
    <button
      onClick={() => (isRunning ? stopTimer() : startTimer(taskId))}
      aria-label={isRunning ? `Stop timing ${title}` : `Start timing ${title}`}
      className={`rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
        isRunning
          ? "bg-accent/15 text-accent"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {isRunning ? "■ Stop" : "▶ Start"}
    </button>
  );
}
