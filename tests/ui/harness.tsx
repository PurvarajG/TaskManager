import { render } from "@testing-library/react";
import { vi } from "vitest";
import { TasksProvider } from "@/lib/store-context";
import type { GeneralNote, Project, ProjectStage, QuickTodo, Task, TimeEntry } from "@/lib/types";

export type Workspace = {
  tasks: Task[];
  projects: Project[];
  stages: ProjectStage[];
  note: GeneralNote;
  quickTodos: QuickTodo[];
  timeEntries: TimeEntry[];
  running: TimeEntry | null;
};

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Write the plan",
    tags: [],
    scheduled: "2026-03-01",
    minutes: 30,
    priority: 0,
    status: "open",
    sortOrder: 0,
    boardOrder: 0,
    createdAt: "2026-03-01T09:00:00.000Z",
    subtasks: [],
    ...overrides,
  };
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Website",
    color: "#0052ff",
    archived: false,
    sortOrder: 0,
    createdAt: "2026-03-01T09:00:00.000Z",
    ...overrides,
  };
}

export function makeStages(projectId: string): ProjectStage[] {
  return (["backlog", "active", "blocked", "done"] as const).map((kind, i) => ({
    id: `3333333${i}-3333-4333-8333-333333333333`,
    projectId,
    name: ["Backlog", "In Progress", "Blocked", "Done"][i],
    kind,
    sortOrder: i,
    createdAt: "2026-03-01T09:00:00.000Z",
  }));
}

export function emptyWorkspace(overrides: Partial<Workspace> = {}): Workspace {
  return {
    tasks: [],
    projects: [],
    stages: [],
    note: { body: "", updatedAt: "2026-03-01T09:00:00.000Z" },
    quickTodos: [],
    timeEntries: [],
    running: null,
    ...overrides,
  };
}

export type MockFetch = {
  /** Every mutating call the component made, in order. */
  calls: { url: string; method: string; body: unknown }[];
  /** Force the next matching request to fail, to exercise rollback paths. */
  failNext: (urlFragment: string, status?: number, error?: string, extra?: object) => void;
  respondWith: (urlFragment: string, value: unknown) => void;
};

/**
 * Renders inside a real TasksProvider with `fetch` stubbed, so the tests
 * exercise the actual optimistic-update and rollback code rather than a mock
 * of it.
 */
export function renderWorkspace(ui: React.ReactNode, workspace: Workspace = emptyWorkspace()) {
  const calls: MockFetch['calls'] = [];
  const failures = new Map<string, { status: number; error: string; extra: object }>();
  const canned = new Map<string, unknown>();

  const initial: Record<string, unknown> = {
    "/api/tasks": workspace.tasks,
    "/api/projects": workspace.projects,
    "/api/stages": workspace.stages,
    "/api/note": workspace.note,
    "/api/quick-todos": workspace.quickTodos,
    "/api/time-entries": { entries: workspace.timeEntries, running: workspace.running },
  };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      if (method !== "GET") calls.push({ url, method, body });

      for (const [fragment, failure] of failures) {
        if (url.includes(fragment)) {
          failures.delete(fragment);
          return new Response(JSON.stringify({ error: failure.error, ...failure.extra }), {
            status: failure.status,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      for (const [fragment, value] of canned) {
        if (url.includes(fragment)) {
          return Response.json(value);
        }
      }

      if (method === "GET" && url in initial) return Response.json(initial[url]);
      // Default: echo the patch back merged over the matching task.
      const id = url.split("/api/tasks/")[1]?.split("/")[0];
      const task = workspace.tasks.find((t) => t.id === id);
      return Response.json(task ? { ...task, ...body } : { ok: true });
    }),
  );

  const mock: MockFetch = {
    calls,
    failNext: (fragment, status = 500, error = "That didn't save", extra = {}) =>
      failures.set(fragment, { status, error, extra }),
    respondWith: (fragment, value) => canned.set(fragment, value),
  };

  return { ...render(<TasksProvider>{ui}</TasksProvider>), mock };
}
