import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

/** `{ archived: true }` archives (the soft path); any other fields rename/recolour/retype. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/categories/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const b = v.body(await json(request));
    if (b.archived === true) return store.archiveCategory(v.uuid(id, "id"));
    return store.updateCategory(v.uuid(id, "id"), {
      ...(b.name !== undefined ? { name: v.nonEmpty(b.name, "Category name", 80) } : {}),
      ...(b.color !== undefined ? { color: v.nonEmpty(b.color, "color", 40) } : {}),
      ...(b.kind !== undefined ? { kind: v.categoryKind(b.kind, "kind") } : {}),
    });
  });
}

/** Refused (409) while segments still reference this category — archive it instead. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/categories/[id]">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const deleted = await store.deleteCategory(v.uuid(id, "id"));
    return deleted ? { ok: true } : null;
  });
}
