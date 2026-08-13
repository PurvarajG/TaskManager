import { handle, json } from "@/lib/api";
import { store } from "@/lib/store";
import { parseQuickAdd } from "@/lib/parse";
import type { TaskInput } from "@/lib/types";
import * as v from "@/lib/validate";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  return handle(async () => (q?.trim() ? store.search(q.trim()) : store.allTasks()));
}

export async function POST(request: Request) {
  return handle(async () => {
    const b = v.body(await json(request));

    // Two ways in: a raw line to parse (web quick-add, Telegram) or explicit fields.
    const parsed = b.text ? parseQuickAdd(v.nonEmpty(b.text, "text", 1000)) : null;

    const projectName = parsed?.projectName ?? v.optionalStr(b.projectName, "projectName", 120);
    const projectId = projectName
      ? (await store.findOrCreateProjectByName(projectName)).id
      : v.optionalUuid(b.projectId, "projectId");

    const input: TaskInput = {
      title: parsed?.title ?? v.nonEmpty(b.title, "Title", 500),
      notes: parsed?.notes ?? v.optionalStr(b.notes, "notes"),
      projectId,
      // A named column only makes sense alongside the project that owns it.
      stageId: projectId ? v.optionalUuid(b.stageId, "stageId") : undefined,
      tags: parsed?.tags ?? (b.tags !== undefined ? v.tags(b.tags, "tags") : []),
      scheduled: parsed?.scheduled ?? v.isoDate(b.scheduled, "scheduled"),
      dueTime: parsed?.dueTime ?? v.optionalTime(b.dueTime, "dueTime"),
      minutes: parsed?.minutes ?? v.duration(b.minutes, "minutes"),
      priority: parsed?.priority ?? (b.priority !== undefined ? v.priority(b.priority, "priority") : 0),
      recurrence: parsed?.recurrence,
    };

    return store.addTask(input);
  }, 201);
}
