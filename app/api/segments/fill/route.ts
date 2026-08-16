import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    return store.fillGap({
      startedAt: v.isoTimestamp(b.startedAt, "startedAt"),
      endedAt: v.isoTimestamp(b.endedAt, "endedAt"),
      categoryId: v.uuid(b.categoryId, "categoryId"),
      activityId: v.optionalUuid(b.activityId, "activityId"),
      note: v.optionalStr(b.note, "note", 500),
    });
  }, 201);
}
