import { randomUUID } from "node:crypto";
import { withTransaction } from "../db";
import type { Activity, ActivityInput } from "../types";
import { db, rowToActivity, type ActivityRow, type Q } from "./rows";

export async function listActivities(categoryId?: string): Promise<Activity[]> {
  const rows = categoryId
    ? await db.query<ActivityRow>(
        `select * from activities where category_id = $1 order by sort_order asc, created_at asc`,
        [categoryId],
      )
    : await db.query<ActivityRow>(
        `select * from activities order by category_id, sort_order asc, created_at asc`,
      );
  return rows.map(rowToActivity);
}

export async function getActivity(id: string, q: Q = db): Promise<Activity | null> {
  const rows = await q.query<ActivityRow>(`select * from activities where id = $1`, [id]);
  return rows.length ? rowToActivity(rows[0]) : null;
}

export async function addActivity(input: ActivityInput): Promise<Activity> {
  const rows = await db.query<ActivityRow>(
    `insert into activities (id, category_id, name, typical_minutes, is_preset, sort_order)
     values ($1, $2, $3, $4, $5,
       coalesce((select max(sort_order)+1 from activities where category_id=$2), 0))
     returning *`,
    [randomUUID(), input.categoryId, input.name, input.typicalMinutes ?? null, input.isPreset ?? false],
  );
  return rowToActivity(rows[0]);
}

export async function updateActivity(
  id: string,
  patch: Partial<ActivityInput>,
): Promise<Activity | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.categoryId !== undefined) {
    sets.push(`category_id = $${i++}`);
    vals.push(patch.categoryId);
  }
  if (patch.name !== undefined) {
    sets.push(`name = $${i++}`);
    vals.push(patch.name);
  }
  if (patch.typicalMinutes !== undefined) {
    sets.push(`typical_minutes = $${i++}`);
    vals.push(patch.typicalMinutes);
  }
  if (patch.isPreset !== undefined) {
    sets.push(`is_preset = $${i++}`);
    vals.push(patch.isPreset);
  }
  if (sets.length === 0) return getActivity(id);
  vals.push(id);
  const rows = await db.query<ActivityRow>(
    `update activities set ${sets.join(", ")} where id = $${i} returning *`,
    vals,
  );
  return rows.length ? rowToActivity(rows[0]) : null;
}

export async function archiveActivity(id: string): Promise<Activity | null> {
  const rows = await db.query<ActivityRow>(
    `update activities set archived = true where id = $1 returning *`,
    [id],
  );
  return rows.length ? rowToActivity(rows[0]) : null;
}

export async function reorderActivities(categoryId: string, orderedIds: string[]): Promise<void> {
  await withTransaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.query(
        `update activities set sort_order = $1 where id = $2 and category_id = $3`,
        [i, orderedIds[i], categoryId],
      );
    }
  });
}
