import { store } from "@/lib/store";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/tasks/[id]/restore">,
) {
  const { id } = await ctx.params;
  const updated = await store.restoreTask(id);
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(updated);
}
