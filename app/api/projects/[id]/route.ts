import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function PATCH(request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const b = v.body(await json(request));
    return store.updateProject(v.uuid(id, "project id"), {
      ...(b.name !== undefined ? { name: v.nonEmpty(b.name, "Project name", 120) } : {}),
      ...(b.color !== undefined ? { color: v.str(b.color, "color", 20) } : {}),
      ...(b.archived !== undefined ? { archived: v.bool(b.archived, "archived") } : {}),
      ...(b.defaultCategoryId !== undefined
        ? { defaultCategoryId: v.optionalUuid(b.defaultCategoryId, "defaultCategoryId") ?? "" }
        : {}),
    });
  });
}

/** Permanent. Surviving tasks keep existing, but lose their project and column. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const removed = await store.deleteProject(v.uuid(id, "project id"));
    return removed ? { ok: true } : null;
  });
}
