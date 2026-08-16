import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function PATCH(request: Request, ctx: RouteContext<"/api/segments/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const b = v.body(await json(request));
    return store.updateSegment(v.uuid(id, "id"), {
      ...(b.startedAt !== undefined ? { startedAt: v.isoTimestamp(b.startedAt, "startedAt") } : {}),
      ...(b.endedAt !== undefined ? { endedAt: v.isoTimestamp(b.endedAt, "endedAt") } : {}),
      ...(b.categoryId !== undefined ? { categoryId: v.uuid(b.categoryId, "categoryId") } : {}),
      ...(b.activityId !== undefined ? { activityId: v.optionalUuid(b.activityId, "activityId") ?? "" } : {}),
      ...(b.taskId !== undefined ? { taskId: v.optionalUuid(b.taskId, "taskId") ?? "" } : {}),
      ...(b.note !== undefined ? { note: v.str(b.note, "note", 500) } : {}),
    });
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/segments/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const deleted = await store.deleteSegment(v.uuid(id, "id"));
    return deleted ? { ok: true } : null;
  });
}
