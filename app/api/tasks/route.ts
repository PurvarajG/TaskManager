import { store } from "@/lib/store";
import { parseQuickAdd } from "@/lib/parse";
import type { TaskInput } from "@/lib/types";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q");
  if (q && q.trim()) return Response.json(await store.search(q.trim()));
  return Response.json(await store.allTasks());
}

export async function POST(request: Request) {
  const body = (await request.json()) as { text?: string } & Partial<TaskInput> & {
    projectName?: string;
  };

  // Two ways in: a raw line to parse (web quick-add, Telegram) or explicit fields.
  const parsed = body.text ? parseQuickAdd(body.text) : null;

  const projectName = parsed?.projectName ?? body.projectName;
  const projectId = projectName
    ? (await store.findOrCreateProjectByName(projectName)).id
    : body.projectId;

  const input: TaskInput = {
    title: parsed?.title ?? body.title ?? "",
    notes: parsed?.notes ?? body.notes,
    projectId,
    tags: parsed?.tags ?? body.tags ?? [],
    scheduled: parsed?.scheduled ?? body.scheduled!,
    dueTime: parsed?.dueTime ?? body.dueTime,
    minutes: parsed?.minutes ?? body.minutes!,
    priority: parsed?.priority ?? body.priority ?? 0,
    recurrence: parsed?.recurrence ?? body.recurrence,
  };

  if (!input.title.trim()) {
    return Response.json({ error: "A task needs a title" }, { status: 400 });
  }

  return Response.json(await store.addTask(input), { status: 201 });
}
