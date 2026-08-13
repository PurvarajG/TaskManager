import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = v.body(await json(request));
    return store.updateQuickTodo(v.uuid(id, "id"), {
      ...(b.title !== undefined ? { title: v.nonEmpty(b.title, "Title", 300) } : {}),
      ...(b.done !== undefined ? { done: v.bool(b.done, "done") } : {}),
    });
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const deleted = await store.deleteQuickTodo(v.uuid(id, "id"));
    return deleted ? { ok: true } : null;
  });
}
