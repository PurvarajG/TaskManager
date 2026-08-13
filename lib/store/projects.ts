import { randomUUID } from "node:crypto";
import { withTransaction } from "../db";
import type { Project, ProjectInput, ProjectStage } from "../types";
import { db, rowToProject, type ProjectRow, type Q } from "./rows";
import { createDefaultStages } from "./stages";

export async function listProjects(): Promise<Project[]> {
  const rows = await db.query<ProjectRow>(
    `select * from projects order by sort_order asc, created_at asc`,
  );
  return rows.map(rowToProject);
}

export async function getProject(id: string, q: Q = db): Promise<Project | null> {
  const rows = await q.query<ProjectRow>(`select * from projects where id = $1`, [id]);
  return rows.length ? rowToProject(rows[0]) : null;
}

/** A project is never created without its board, so the two are one transaction. */
export async function addProject(
  input: ProjectInput,
): Promise<{ project: Project; stages: ProjectStage[] }> {
  return withTransaction(async (tx) => {
    const rows = await tx.query<ProjectRow>(
      `insert into projects (id, name, color, sort_order)
       values ($1,$2,$3, coalesce((select max(sort_order)+1 from projects), 0))
       returning *`,
      [randomUUID(), input.name, input.color ?? "#0052ff"],
    );
    const project = rowToProject(rows[0]);
    return { project, stages: await createDefaultStages(tx, project.id) };
  });
}

export async function findOrCreateProjectByName(name: string): Promise<Project> {
  const existing = await db.query<ProjectRow>(
    `select * from projects where lower(name) = lower($1) limit 1`,
    [name],
  );
  if (existing.length) return rowToProject(existing[0]);
  return (await addProject({ name })).project;
}

export async function updateProject(
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
  if (sets.length === 0) return getProject(id);
  vals.push(id);
  const rows = await db.query<ProjectRow>(
    `update projects set ${sets.join(", ")} where id = $${i} returning *`,
    vals,
  );
  return rows.length ? rowToProject(rows[0]) : null;
}

/** Surviving tasks lose their project and their stage together. */
export async function deleteProject(id: string): Promise<boolean> {
  return withTransaction(async (tx) => {
    await tx.query(
      `update tasks set project_id = null, stage_id = null, board_order = 0 where project_id = $1`,
      [id],
    );
    const rows = await tx.query<{ id: string }>(
      `delete from projects where id = $1 returning id`,
      [id],
    );
    return rows.length > 0;
  });
}
