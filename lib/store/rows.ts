import { query } from "../db";
import type { Tx } from "../db";
import type {
  Duration,
  Priority,
  Project,
  ProjectStage,
  QuickTodo,
  Recurrence,
  StageKind,
  Status,
  Subtask,
  Task,
  TimeEntry,
} from "../types";

/** Every store module reads through this so it works inside or outside a transaction. */
export type Q = Pick<Tx, "query">;
export const db: Q = { query };

export type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  project_id: string | null;
  stage_id: string | null;
  board_order: number;
  tags: string[];
  scheduled: string;
  due_time: string | null;
  minutes: number;
  priority: number;
  status: string;
  recurrence: Recurrence | null;
  sort_order: number;
  created_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};

export type ProjectRow = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  sort_order: number;
  created_at: string;
};

export type StageRow = {
  id: string;
  project_id: string;
  name: string;
  kind: string;
  sort_order: number;
  created_at: string;
};

export type SubtaskRow = {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  sort_order: number;
};

export type QuickTodoRow = {
  id: string;
  title: string;
  done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TimeEntryRow = {
  id: string;
  task_id: string;
  started_at: string;
  ended_at: string | null;
  minutes: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

/** Postgres returns DATE columns as JS Date objects (via postgres.js); PGlite
 * returns them as strings. Normalize both to a plain YYYY-MM-DD. */
export function isoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export function ts(v: string | Date): string {
  return new Date(v).toISOString();
}

export function rowToProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    archived: r.archived,
    sortOrder: r.sort_order,
    createdAt: ts(r.created_at),
  };
}

export function rowToStage(r: StageRow): ProjectStage {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    kind: r.kind as StageKind,
    sortOrder: r.sort_order,
    createdAt: ts(r.created_at),
  };
}

export function rowToSubtask(r: SubtaskRow): Subtask {
  return {
    id: r.id,
    taskId: r.task_id,
    title: r.title,
    done: r.done,
    sortOrder: r.sort_order,
  };
}

export function rowToTask(r: TaskRow, subtasks: Subtask[]): Task {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes ?? undefined,
    projectId: r.project_id ?? undefined,
    stageId: r.stage_id ?? undefined,
    boardOrder: r.board_order ?? 0,
    tags: r.tags ?? [],
    scheduled: isoDate(r.scheduled),
    dueTime: r.due_time ?? undefined,
    minutes: r.minutes as Duration,
    priority: r.priority as Priority,
    status: r.status as Status,
    recurrence: r.recurrence ?? undefined,
    sortOrder: r.sort_order,
    createdAt: ts(r.created_at),
    completedAt: r.completed_at ? ts(r.completed_at) : undefined,
    deletedAt: r.deleted_at ? ts(r.deleted_at) : undefined,
    subtasks,
  };
}

export function rowToQuickTodo(r: QuickTodoRow): QuickTodo {
  return {
    id: r.id,
    title: r.title,
    done: r.done,
    sortOrder: r.sort_order,
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}

export function rowToTimeEntry(r: TimeEntryRow): TimeEntry {
  return {
    id: r.id,
    taskId: r.task_id,
    startedAt: ts(r.started_at),
    endedAt: r.ended_at ? ts(r.ended_at) : undefined,
    minutes: r.minutes ?? undefined,
    note: r.note ?? undefined,
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}

export async function subtasksFor(q: Q, taskIds: string[]): Promise<Map<string, Subtask[]>> {
  const map = new Map<string, Subtask[]>();
  if (taskIds.length === 0) return map;
  const rows = await q.query<SubtaskRow>(
    `select * from subtasks where task_id = any($1) order by sort_order asc, created_at asc`,
    [taskIds],
  );
  for (const r of rows) {
    const list = map.get(r.task_id) ?? [];
    list.push(rowToSubtask(r));
    map.set(r.task_id, list);
  }
  return map;
}

export async function hydrate(q: Q, rows: TaskRow[]): Promise<Task[]> {
  const subs = await subtasksFor(q, rows.map((r) => r.id));
  return rows.map((r) => rowToTask(r, subs.get(r.id) ?? []));
}
