import { FOCUS_WORK_CATEGORY_ID } from "../types";
import { db, type Q } from "./rows";

/**
 * The category a task's timer sessions land in: its project's configured
 * default, falling back to Focus Work. Single source of truth so the
 * server-side timer path and any client-side preview can't diverge.
 */
export async function resolveTaskCategoryId(taskId: string, q: Q = db): Promise<string> {
  const rows = await q.query<{ default_category_id: string | null }>(
    `select p.default_category_id
       from tasks t
       join projects p on p.id = t.project_id
      where t.id = $1`,
    [taskId],
  );
  return rows[0]?.default_category_id ?? FOCUS_WORK_CATEGORY_ID;
}
