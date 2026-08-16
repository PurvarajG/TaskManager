import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    const taskId = b.taskId !== undefined ? v.optionalUuid(b.taskId, "taskId") : undefined;
    return store.fillGap({
      startedAt: v.isoTimestamp(b.startedAt, "startedAt"),
      endedAt: v.isoTimestamp(b.endedAt, "endedAt"),
      // A task-linked fill gets its category from the task's project server-side — see resolveCategoryId.
      categoryId: taskId ? undefined : v.uuid(b.categoryId, "categoryId"),
      activityId: b.activityId !== undefined ? v.optionalUuid(b.activityId, "activityId") : undefined,
      taskId,
      note: v.optionalStr(b.note, "note", 500),
    });
  }, 201);
}
