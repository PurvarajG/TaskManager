import { randomUUID } from "node:crypto";
import { withTransaction } from "../db";
import type { QuickTodo, Task, TaskInput } from "../types";
import { db, hydrate, rowToQuickTodo, type QuickTodoRow, type TaskRow } from "./rows";
import { firstOpenStageOf } from "./stages";

export async function listQuickTodos(): Promise<QuickTodo[]> {
  const rows = await db.query<QuickTodoRow>(
    `select * from quick_todos order by sort_order asc, created_at asc`,
  );
  return rows.map(rowToQuickTodo);
}

export async function addQuickTodo(title: string): Promise<QuickTodo> {
  const rows = await db.query<QuickTodoRow>(
    `insert into quick_todos (id, title, sort_order)
     values ($1, $2, coalesce((select max(sort_order)+1 from quick_todos), 0))
     returning *`,
    [randomUUID(), title],
  );
  return rowToQuickTodo(rows[0]);
}

export async function updateQuickTodo(
  id: string,
  patch: { title?: string; done?: boolean },
): Promise<QuickTodo | null> {
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
  const rows = await db.query<QuickTodoRow>(
    `update quick_todos set ${sets.join(", ")}, updated_at = now() where id = $${i} returning *`,
    vals,
  );
  return rows.length ? rowToQuickTodo(rows[0]) : null;
}

export async function deleteQuickTodo(id: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `delete from quick_todos where id = $1 returning id`,
    [id],
  );
  return rows.length > 0;
}

export async function reorderQuickTodos(orderedIds: string[]): Promise<void> {
  await withTransaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.query(`update quick_todos set sort_order = $1 where id = $2`, [i, orderedIds[i]]);
    }
  });
}

/**
 * Graduating a checklist item into a real task. Both halves are one
 * transaction so a failed insert can never leave the item deleted, and a
 * failed delete can never leave it duplicated.
 */
export async function convertQuickTodo(
  id: string,
  input: Omit<TaskInput, "title"> & { title?: string },
): Promise<Task | null> {
  return withTransaction(async (tx) => {
    const found = await tx.query<QuickTodoRow>(`select * from quick_todos where id = $1`, [id]);
    if (found.length === 0) return null;

    const title = input.title?.trim() || found[0].title;
    const stageId = input.projectId
      ? ((await firstOpenStageOf(tx, input.projectId))?.id ?? null)
      : null;

    const rows = await tx.query<TaskRow>(
      `insert into tasks
         (id, title, notes, project_id, stage_id, tags, scheduled, due_time, minutes,
          priority, status, recurrence, sort_order, board_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open',$11,
         coalesce((select max(sort_order) + 1 from tasks), 0),
         coalesce((select max(board_order) + 1 from tasks where stage_id = $5), 0))
       returning *`,
      [
        randomUUID(),
        title,
        input.notes ?? null,
        input.projectId ?? null,
        stageId,
        input.tags ?? [],
        input.scheduled,
        input.dueTime ?? null,
        input.minutes,
        input.priority,
        input.recurrence ? JSON.stringify(input.recurrence) : null,
      ],
    );

    await tx.query(`delete from quick_todos where id = $1`, [id]);
    return (await hydrate(tx, rows))[0];
  });
}
