import { store } from "@/lib/store";
import type { TaskInput } from "@/lib/types";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]">,
) {
  const { id } = await ctx.params;
  const patch = (await request.json()) as Partial<TaskInput>;

  const updated = await store.updateTask(id, patch);
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(updated);
}

/** Soft delete — moves the task to Trash. Use /forever to remove it for good. */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/tasks/[id]">,
) {
  const { id } = await ctx.params;

  const removed = await store.trashTask(id);
  if (!removed) return Response.json({ error: "Not found" }, { status: 404 });

  return new Response(null, { status: 204 });
}
