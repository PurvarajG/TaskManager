import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Kanban drop: which column, and where in it. */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = v.body(await json(request));
    return store.moveTaskToStage(
      v.uuid(id, "task id"),
      v.uuid(b.stageId, "stageId"),
      v.index(b.index ?? 0, "index"),
    );
  });
}
