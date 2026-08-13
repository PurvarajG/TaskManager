import { store } from "@/lib/store";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/tasks/[id]/complete">,
) {
  const { id } = await ctx.params;
  const result = await store.completeTask(id);
  if (!result) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(result);
}
