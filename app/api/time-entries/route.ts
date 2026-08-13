import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import * as v from "@/lib/validate";

export async function GET(request: Request) {
  const taskId = new URL(request.url).searchParams.get("taskId");
  return handle(async () => ({
    entries: await store.listTimeEntries(taskId ? v.uuid(taskId, "taskId") : undefined),
    running: await store.runningEntry(),
  }));
}

/**
 * Three shapes, one endpoint: start a timer, hand the timer over to another
 * task in one atomic step, or record time that was never timed at all.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));
    const taskId = v.uuid(b.taskId, "taskId");
    if (!(await store.getTask(taskId))) return null;

    if (b.minutes !== undefined) {
      return store.addManualEntry({
        taskId,
        startedAt: v.isoTimestamp(b.startedAt, "startedAt"),
        minutes: v.minutes(b.minutes, "minutes"),
        note: v.optionalStr(b.note, "note", 500),
      });
    }

    if (b.replaceRunning === true) return store.switchTimer(taskId);
    return store.startTimer(taskId);
  }, 201);
}
