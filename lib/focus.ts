import { daysBetween } from "./parse";
import { rank } from "./format";
import { isOverdue } from "./summary";
import { STALE_AFTER_DAYS, type ProjectStage, type Task, type TimeEntry } from "./types";

/** How many days a task has sat on its scheduled date, as of `todayISO`. */
export function taskAge(task: Task, todayISO: string): number {
  return daysBetween(task.scheduled, todayISO);
}

/**
 * A task that has sat open past `STALE_AFTER_DAYS` on its scheduled date —
 * the banner condition in `TaskRow` ("Still doing it" / "Let it go") and the
 * stalled-waiting half of the project focus band's attention list.
 */
export function isStale(task: Task, todayISO: string): boolean {
  return task.status === "open" && taskAge(task, todayISO) > STALE_AFTER_DAYS;
}

// One overdue definition for the whole app — see lib/summary.ts.

function isDueToday(task: Task, todayISO: string): boolean {
  if (task.status !== "open") return false;
  if (task.isComplex) return task.scheduled <= todayISO && todayISO <= task.finishDate!;
  return task.scheduled === todayISO;
}

/**
 * The single task a project screen should put in front of you: whatever is
 * currently being timed (if it's this project's), otherwise the
 * highest-priority open task that's due today or overdue in this project.
 * Returns null when there's nothing to focus on.
 */
export function getFocusTask(
  tasks: Task[],
  projectId: string,
  running: Pick<TimeEntry, "taskId"> | null | undefined,
  todayISO: string,
): Task | null {
  const projectTasks = tasks.filter((t) => t.projectId === projectId && t.status !== "trashed");

  if (running) {
    const runningTask = projectTasks.find((t) => t.id === running.taskId);
    if (runningTask) return runningTask;
  }

  const candidates = projectTasks.filter(
    (t) => t.status === "open" && (isOverdue(t, todayISO) || isDueToday(t, todayISO)),
  );
  if (candidates.length === 0) return null;

  return candidates.sort(
    (a, b) => rank(a) - rank(b) || a.scheduled.localeCompare(b.scheduled),
  )[0];
}

export type AttentionItem = {
  task: Task;
  reason: "overdue" | "stalled-waiting";
  detail: string;
};

/**
 * Tasks the project screen should flag as needing a decision: anything
 * overdue, plus anything sitting in a waiting-kind stage with no follow-up
 * past the same staleness threshold `TaskRow` already uses.
 */
export function getAttentionItems(
  tasks: Task[],
  stages: ProjectStage[],
  projectId: string,
  todayISO: string,
): AttentionItem[] {
  const projectTasks = tasks.filter((t) => t.projectId === projectId && t.status !== "trashed");
  const waitingStageIds = new Set(
    stages.filter((s) => s.projectId === projectId && s.kind === "blocked").map((s) => s.id),
  );
  const isWaiting = (task: Task) => !!task.stageId && waitingStageIds.has(task.stageId);

  const items: AttentionItem[] = [];

  // A waiting-kind stage's tasks are judged on staleness ("no follow-up
  // date"), not the scheduled-date deadline every other stage uses — the two
  // rules would otherwise always overlap, since staleness implies the
  // scheduled date has passed too.
  for (const task of projectTasks) {
    if (isWaiting(task)) continue;
    if (task.status !== "open" || !isOverdue(task, todayISO)) continue;
    const age = taskAge(task, todayISO);
    items.push({
      task,
      reason: "overdue",
      detail: `Overdue by ${age} ${age === 1 ? "day" : "days"} · reschedule or complete`,
    });
  }

  for (const task of projectTasks) {
    if (!isWaiting(task) || !isStale(task, todayISO)) continue;
    items.push({ task, reason: "stalled-waiting", detail: "Waiting with no follow-up date" });
  }

  return items;
}
