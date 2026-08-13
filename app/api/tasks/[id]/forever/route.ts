import { store } from "@/lib/store";

/** Permanent delete — only reachable from the Trash view. */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/tasks/[id]/forever">,
) {
  const { id } = await ctx.params;
  const removed = await store.deleteTaskForever(id);
  if (!removed) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
