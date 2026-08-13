import { store } from "@/lib/store";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]/subtasks/[subId]">,
) {
  const { subId } = await ctx.params;
  const patch = (await request.json()) as { title?: string; done?: boolean };
  const updated = await store.updateSubtask(subId, patch);
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/tasks/[id]/subtasks/[subId]">,
) {
  const { subId } = await ctx.params;
  const removed = await store.deleteSubtask(subId);
  if (!removed) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
