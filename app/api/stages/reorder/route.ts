import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    await store.reorderStages(v.uuid(b.projectId, "projectId"), v.uuidList(b.ids, "ids"));
    return { ok: true };
  });
}
