import { store } from "@/lib/store";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/tasks/[id]/reopen">,
) {
  const { id } = await ctx.params;
  const updated = await store.reopenTask(id);
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(updated);
}
