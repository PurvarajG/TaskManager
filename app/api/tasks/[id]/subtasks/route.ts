import { store } from "@/lib/store";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/tasks/[id]/subtasks">,
) {
  const { id } = await ctx.params;
  const { title } = (await request.json()) as { title?: string };
  if (!title?.trim()) {
    return Response.json({ error: "A subtask needs a title" }, { status: 400 });
  }
  return Response.json(await store.addSubtask(id, title.trim()), { status: 201 });
}
