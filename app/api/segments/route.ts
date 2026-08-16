import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  return handle(async () => ({
    segments: await store.listSegments(
      v.isoTimestamp(from, "from"),
      v.isoTimestamp(to, "to"),
    ),
    running: await store.runningSegment(),
  }));
}

/**
 * Three shapes, one endpoint: start tracking, hand the timer over to a new
 * category/activity/task in one atomic step, or record a span that was never
 * timed live (an offline manual entry, distinct from filling a detected gap).
 */
export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    const categoryId = v.uuid(b.categoryId, "categoryId");
    const activityId = b.activityId !== undefined ? v.optionalUuid(b.activityId, "activityId") : undefined;
    const taskId = b.taskId !== undefined ? v.optionalUuid(b.taskId, "taskId") : undefined;
    const note = v.optionalStr(b.note, "note", 500);

    if (b.startedAt !== undefined && b.endedAt !== undefined) {
      return store.addManualSegment({
        startedAt: v.isoTimestamp(b.startedAt, "startedAt"),
        endedAt: v.isoTimestamp(b.endedAt, "endedAt"),
        categoryId,
        activityId,
        taskId,
        note,
      });
    }

    if (b.replaceRunning === true) return store.switchSegment({ categoryId, activityId, taskId, note });
    return store.startSegment({ categoryId, activityId, taskId, note });
  }, 201);
}
