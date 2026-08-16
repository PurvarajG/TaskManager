import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

/** `{ archived: true }` archives; any other fields rename, move category, retype, or reset typical duration. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/activities/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const b = v.body(await json(request));
    if (b.archived === true) return store.archiveActivity(v.uuid(id, "id"));
    return store.updateActivity(v.uuid(id, "id"), {
      ...(b.categoryId !== undefined ? { categoryId: v.uuid(b.categoryId, "categoryId") } : {}),
      ...(b.name !== undefined ? { name: v.nonEmpty(b.name, "Activity name", 80) } : {}),
      ...(b.typicalMinutes !== undefined
        ? { typicalMinutes: b.typicalMinutes === null ? 0 : v.minutes(b.typicalMinutes, "typicalMinutes") }
        : {}),
      ...(b.isPreset !== undefined ? { isPreset: v.bool(b.isPreset, "isPreset") } : {}),
    });
  });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/activities/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const deleted = await store.deleteActivity(v.uuid(id, "id"));
    return deleted ? { ok: true } : null;
  });
}
