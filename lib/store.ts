import { randomUUID } from "node:crypto";
import { query } from "./db";
import { nextOccurrence } from "./parse";
import type {
  Duration,
  Priority,
  Project,
  ProjectInput,
  Recurrence,
  Status,
  Subtask,
  Task,
  TaskInput,
} from "./types";

type TaskRow = {
  id: string;
  title: string;
  notes: string | null;
  project_id: string | null;
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

type ProjectRow = {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  sort_order: number;
  created_at: string;
};

type SubtaskRow = {
  id: string;
  task_id: string;
  title: string;
  done: boolean;
  sort_order: number;
};

/** Postgres returns DATE columns as JS Date objects (via postgres.js); PGlite
 * returns them as strings. Normalize both to a plain YYYY-MM-DD. */
function isoDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function rowToProject(r: ProjectRow): Project {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    archived: r.archived,
    sortOrder: r.sort_order,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

function rowToSubtask(r: SubtaskRow): Subtask {
  return {
    id: r.id,
    taskId: r.task_id,
    title: r.title,
    done: r.done,
    sortOrder: r.sort_order,
  };
}

function rowToTask(r: TaskRow, subtasks: Subtask[]): Task {
  return {
    id: r.id,
    title: r.title,
    notes: r.notes ?? undefined,
    projectId: r.project_id ?? undefined,
    tags: r.tags ?? [],
    scheduled: isoDate(r.scheduled),
    dueTime: r.due_time ?? undefined,
    minutes: r.minutes as Duration,
    priority: r.priority as Priority,
    status: r.status as Status,
    recurrence: r.recurrence ?? undefined,
    sortOrder: r.sort_order,
    createdAt: new Date(r.created_at).toISOString(),
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : undefined,
    deletedAt: r.deleted_at ? new Date(r.deleted_at).toISOString() : undefined,
    subtasks,
  };
}

async function subtasksFor(taskIds: string[]): Promise<Map<string, Subtask[]>> {
  const map = new Map<string, Subtask[]>();
  if (taskIds.length === 0) return map;
  const rows = await query<SubtaskRow>(
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

async function hydrate(rows: TaskRow[]): Promise<Task[]> {
  const subs = await subtasksFor(rows.map((r) => r.id));
  return rows.map((r) => rowToTask(r, subs.get(r.id) ?? []));
}

export const store = {
  // ── Tasks ────────────────────────────────────────────────────────────
  async allTasks(): Promise<Task[]> {
    const rows = await query<TaskRow>(
      `select * from tasks where status <> 'trashed' order by sort_order asc, created_at asc`,
    );
    return hydrate(rows);
  },

  async trashedTasks(): Promise<Task[]> {
    const rows = await query<TaskRow>(
      `select * from tasks where status = 'trashed' order by deleted_at desc`,
    );
    return hydrate(rows);
  },

  async getTask(id: string): Promise<Task | null> {
    const rows = await query<TaskRow>(`select * from tasks where id = $1`, [id]);
    if (rows.length === 0) return null;
    return (await hydrate(rows))[0];
  },

  async search(q: string): Promise<Task[]> {
    const rows = await query<TaskRow>(
      `select * from tasks
       where status <> 'trashed' and (title ilike $1 or notes ilike $1 or $2 = any(tags))
       order by scheduled asc`,
      [`%${q}%`, q.toLowerCase()],
    );
    return hydrate(rows);
  },

  async addTask(input: TaskInput): Promise<Task> {
    const id = randomUUID();
    const rows = await query<TaskRow>(
      `insert into tasks
         (id, title, notes, project_id, tags, scheduled, due_time, minutes, priority, status, recurrence, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',$10,
         coalesce((select max(sort_order) + 1 from tasks), 0))
       returning *`,
      [
        id,
        input.title,
        input.notes ?? null,
        input.projectId ?? null,
        input.tags ?? [],
        input.scheduled,
        input.dueTime ?? null,
        input.minutes,
        input.priority,
        input.recurrence ? JSON.stringify(input.recurrence) : null,
      ],
    );
    return (await hydrate(rows))[0];
  },

  async updateTask(id: string, patch: Partial<TaskInput>): Promise<Task | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    const col = (name: string, value: unknown) => {
      sets.push(`${name} = $${i++}`);
      vals.push(value);
    };

    if (patch.title !== undefined) col("title", patch.title);
    if (patch.notes !== undefined) col("notes", patch.notes || null);
    if (patch.projectId !== undefined) col("project_id", patch.projectId || null);
    if (patch.tags !== undefined) col("tags", patch.tags);
    if (patch.scheduled !== undefined) col("scheduled", patch.scheduled);
    if (patch.dueTime !== undefined) col("due_time", patch.dueTime || null);
    if (patch.minutes !== undefined) col("minutes", patch.minutes);
    if (patch.priority !== undefined) col("priority", patch.priority);
    if (patch.recurrence !== undefined)
      col("recurrence", patch.recurrence ? JSON.stringify(patch.recurrence) : null);

    if (sets.length === 0) return this.getTask(id);

    vals.push(id);
    const rows = await query<TaskRow>(
      `update tasks set ${sets.join(", ")} where id = $${i} returning *`,
      vals,
    );
    if (rows.length === 0) return null;
    return (await hydrate(rows))[0];
  },

  /** Marks done, and if the task recurs, spins up the next occurrence. */
  async completeTask(id: string): Promise<{ task: Task; next: Task | null } | null> {
    const task = await this.getTask(id);
    if (!task) return null;

    const rows = await query<TaskRow>(
      `update tasks set status = 'done', completed_at = now() where id = $1 returning *`,
      [id],
    );
    if (rows.length === 0) return null;

    let next: Task | null = null;
    if (task.recurrence) {
      next = await this.addTask({
        title: task.title,
        notes: task.notes,
        projectId: task.projectId,
        tags: task.tags,
        scheduled: nextOccurrence(task.scheduled, task.recurrence),
        dueTime: task.dueTime,
        minutes: task.minutes,
        priority: task.priority,
        recurrence: task.recurrence,
      });
    }

    return { task: (await hydrate(rows))[0], next };
  },

  async reopenTask(id: string): Promise<Task | null> {
    const rows = await query<TaskRow>(
      `update tasks set status = 'open', completed_at = null where id = $1 returning *`,
      [id],
    );
    if (rows.length === 0) return null;
    return (await hydrate(rows))[0];
  },

  async trashTask(id: string): Promise<boolean> {
    const rows = await query<TaskRow>(
      `update tasks set status = 'trashed', deleted_at = now() where id = $1 returning id`,
      [id],
    );
    return rows.length > 0;
  },

  async restoreTask(id: string): Promise<Task | null> {
    const rows = await query<TaskRow>(
      `update tasks set status = 'open', deleted_at = null where id = $1 returning *`,
      [id],
    );
    if (rows.length === 0) return null;
    return (await hydrate(rows))[0];
  },

  async deleteTaskForever(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>(`delete from tasks where id = $1 returning id`, [id]);
    return rows.length > 0;
  },

  async reorderTasks(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await query(`update tasks set sort_order = $1 where id = $2`, [i, orderedIds[i]]);
    }
  },

  // ── Subtasks ─────────────────────────────────────────────────────────
  async addSubtask(taskId: string, title: string): Promise<Subtask> {
    const id = randomUUID();
    const rows = await query<SubtaskRow>(
      `insert into subtasks (id, task_id, title, sort_order)
       values ($1,$2,$3, coalesce((select max(sort_order)+1 from subtasks where task_id=$2), 0))
       returning *`,
      [id, taskId, title],
    );
    return rowToSubtask(rows[0]);
  },

  async updateSubtask(id: string, patch: { title?: string; done?: boolean }): Promise<Subtask | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (patch.title !== undefined) {
      sets.push(`title = $${i++}`);
      vals.push(patch.title);
    }
    if (patch.done !== undefined) {
      sets.push(`done = $${i++}`);
      vals.push(patch.done);
    }
    if (sets.length === 0) return null;
    vals.push(id);
    const rows = await query<SubtaskRow>(
      `update subtasks set ${sets.join(", ")} where id = $${i} returning *`,
      vals,
    );
    return rows.length ? rowToSubtask(rows[0]) : null;
  },

  async deleteSubtask(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>(`delete from subtasks where id = $1 returning id`, [id]);
    return rows.length > 0;
  },

  // ── Projects ─────────────────────────────────────────────────────────
  async listProjects(): Promise<Project[]> {
    const rows = await query<ProjectRow>(
      `select * from projects order by sort_order asc, created_at asc`,
    );
    return rows.map(rowToProject);
  },

  async getProject(id: string): Promise<Project | null> {
    const rows = await query<ProjectRow>(`select * from projects where id = $1`, [id]);
    return rows.length ? rowToProject(rows[0]) : null;
  },

  async addProject(input: ProjectInput): Promise<Project> {
    const id = randomUUID();
    const rows = await query<ProjectRow>(
      `insert into projects (id, name, color, sort_order)
       values ($1,$2,$3, coalesce((select max(sort_order)+1 from projects), 0))
       returning *`,
      [id, input.name, input.color ?? "#0052ff"],
    );
    return rowToProject(rows[0]);
  },

  async findOrCreateProjectByName(name: string): Promise<Project> {
    const existing = await query<ProjectRow>(
      `select * from projects where lower(name) = lower($1) limit 1`,
      [name],
    );
    if (existing.length) return rowToProject(existing[0]);
    return this.addProject({ name });
  },

  async updateProject(
    id: string,
    patch: Partial<ProjectInput & { archived: boolean }>,
  ): Promise<Project | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (patch.name !== undefined) {
      sets.push(`name = $${i++}`);
      vals.push(patch.name);
    }
    if (patch.color !== undefined) {
      sets.push(`color = $${i++}`);
      vals.push(patch.color);
    }
    if (patch.archived !== undefined) {
      sets.push(`archived = $${i++}`);
      vals.push(patch.archived);
    }
    if (sets.length === 0) return this.getProject(id);
    vals.push(id);
    const rows = await query<ProjectRow>(
      `update projects set ${sets.join(", ")} where id = $${i} returning *`,
      vals,
    );
    return rows.length ? rowToProject(rows[0]) : null;
  },

  async deleteProject(id: string): Promise<boolean> {
    await query(`update tasks set project_id = null where project_id = $1`, [id]);
    const rows = await query<{ id: string }>(`delete from projects where id = $1 returning id`, [id]);
    return rows.length > 0;
  },
};
