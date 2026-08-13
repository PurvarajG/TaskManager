import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Only stopped and manual entries are editable; a running one must be stopped first. */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = v.body(await json(request));
    return store.updateTimeEntry(v.uuid(id, "id"), {
      ...(b.startedAt !== undefined ? { startedAt: v.isoTimestamp(b.startedAt, "startedAt") } : {}),
      ...(b.minutes !== undefined ? { minutes: v.minutes(b.minutes, "minutes") } : {}),
      ...(b.note !== undefined ? { note: v.str(b.note, "note", 500) } : {}),
    });
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const deleted = await store.deleteTimeEntry(v.uuid(id, "id"));
    return deleted ? { ok: true } : null;
  });
}
