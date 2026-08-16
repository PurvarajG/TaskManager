import { randomUUID } from "node:crypto";
import { withTransaction } from "../db";
import type { Category, CategoryInput } from "../types";
import { db, rowToCategory, type CategoryRow, type Q } from "./rows";

/** Thrown when deleting a category that still has segments; APIs map it to 409. */
export class CategoryInUse extends Error {}

export async function listCategories(): Promise<Category[]> {
  const rows = await db.query<CategoryRow>(
    `select * from categories order by sort_order asc, created_at asc`,
  );
  return rows.map(rowToCategory);
}

export async function getCategory(id: string, q: Q = db): Promise<Category | null> {
  const rows = await q.query<CategoryRow>(`select * from categories where id = $1`, [id]);
  return rows.length ? rowToCategory(rows[0]) : null;
}

export async function addCategory(input: CategoryInput): Promise<Category> {
  const rows = await db.query<CategoryRow>(
    `insert into categories (id, name, color, kind, sort_order)
     values ($1, $2, $3, $4, coalesce((select max(sort_order)+1 from categories), 0))
     returning *`,
    [randomUUID(), input.name, input.color, input.kind],
  );
  return rowToCategory(rows[0]);
}

export async function updateCategory(
  id: string,
  patch: Partial<CategoryInput>,
): Promise<Category | null> {
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
  if (patch.kind !== undefined) {
    sets.push(`kind = $${i++}`);
    vals.push(patch.kind);
  }
  if (sets.length === 0) return getCategory(id);
  vals.push(id);
  const rows = await db.query<CategoryRow>(
    `update categories set ${sets.join(", ")} where id = $${i} returning *`,
    vals,
  );
  return rows.length ? rowToCategory(rows[0]) : null;
}

/** The soft path: a category with segments can never be deleted, only archived. */
export async function archiveCategory(id: string): Promise<Category | null> {
  const rows = await db.query<CategoryRow>(
    `update categories set archived = true where id = $1 returning *`,
    [id],
  );
  return rows.length ? rowToCategory(rows[0]) : null;
}

export async function deleteCategory(id: string): Promise<boolean> {
  return withTransaction(async (tx) => {
    const [{ n }] = await tx.query<{ n: number }>(
      `select count(*)::int as n from segments where category_id = $1`,
      [id],
    );
    if (n > 0) throw new CategoryInUse("This category has recorded time — archive it instead");
    const rows = await tx.query<{ id: string }>(
      `delete from categories where id = $1 returning id`,
      [id],
    );
    return rows.length > 0;
  });
}

export async function reorderCategories(orderedIds: string[]): Promise<void> {
  await withTransaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.query(`update categories set sort_order = $1 where id = $2`, [i, orderedIds[i]]);
    }
  });
}
