import { store } from "@/lib/store";
import type { ProjectInput } from "@/lib/types";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/projects/[id]">,
) {
  const { id } = await ctx.params;
  const patch = (await request.json()) as Partial<ProjectInput & { archived: boolean }>;
  const updated = await store.updateProject(id, patch);
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/projects/[id]">,
) {
  const { id } = await ctx.params;
  const removed = await store.deleteProject(id);
  if (!removed) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
